// 空のDesmosStateを返すユーティリティ
export function getBlankDesmosState(): DesmosState {
  return {
    version: 1,
    randomSeed: "",
    graph: {
      viewport: {
        xmin: -10,
        ymin: -10,
        xmax: 10,
        ymax: 10,
      },
      showGrid: true,
      showXAxis: true,
      showYAxis: true,
    },
    expressions: {
      list: [],
    },
  };
}
import type { Calculator, DesmosState } from "../types/desmos";
import type {
  StateEvent,
  ContinuousEvent,
  UnifiedEvent,
  VideoExportSettings,
} from "../types/timeline";
import { deepCopy } from "./deepCopy";

// デバッグモードのフラグ
const DEBUG_MODE = true;

// デバッグ用のログ関数
const debugLog = (...args: unknown[]) => {
  if (DEBUG_MODE) {
    console.log("[StateManager]", ...args);
  }
};

export class StateManager {
  // 動画設定（VideoExportPanelから受け取る型に統一）
  private _videoSettings?: VideoExportSettings;

  // videoSettingsのgetter/setter
  public get videoSettings(): VideoExportSettings | undefined {
    return this._videoSettings;
  }
  public set videoSettings(settings: VideoExportSettings | undefined) {
    this._videoSettings = settings;
    this.clearCache(); // 設定変更時はキャッシュクリア
    debugLog("Video settings updated:", settings);
  }
  // 指定時刻のスクリーンショットをキャッシュに保存
  setScreenshotAtFrame(frame: number, screenshot: string) {
    const cache = this.stateCache.get(frame);
    if (cache) {
      cache.screenshot = Promise.resolve(screenshot);
    } else {
      this.stateCache.set(frame, {
        state: getBlankDesmosState(),
        screenshot: Promise.resolve(screenshot),
      });
    }
  }

  // 計算用calculator取得用getter
  public getComputeCalculator(): Calculator | null {
    // destroy済みかどうか判定（簡易: getStateが例外を投げる場合）
    try {
      if (this.computeCalculator) {
        // getStateを呼んでみてエラーならdestroy済み
        this.computeCalculator.getState();
        return this.computeCalculator;
      }
    } catch (e) {
      // destroy済み
      return null;
    }
    return null;
  }
  private timeline: UnifiedEvent[];
  private stateEvents: StateEvent[];
  private continuousEvents: ContinuousEvent[];

  // 計算用calculator（非表示、state計算専用）
  private computeCalculator: Calculator | null = null;

  // 状態キャッシュ（DesmosStateとスクリーンショット）
  private stateCache: Map<number, { state: DesmosState; screenshot?: Promise<string> }> = new Map();

  constructor(
    timeline: UnifiedEvent[] = [],
    stateEvents: StateEvent[] = [],
    continuousEvents: ContinuousEvent[] = []
  ) {
    this.timeline = [...timeline].sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
    this.stateEvents = [...stateEvents].sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
    this.continuousEvents = continuousEvents;

    debugLog("StateManagerV2 initialized with:", {
      timelineEvents: this.timeline.length,
      stateEvents: this.stateEvents.length,
      continuousEvents: this.continuousEvents.length,
    });
  }

  // 計算用calculatorを設定
  setComputeCalculator(calculator: Calculator): void {
    this.computeCalculator = calculator;
    debugLog("Compute calculator set");
  }

  // 指定時刻の状態とスクリーンショットを計算して取得
  async getStateAtFrame(frame: number): Promise<DesmosState> {
    if (!this.computeCalculator) {
      throw new Error("Compute calculator not set. Call setComputeCalculator() first.");
    }

    // 1. まずキャッシュを確認
    if (this.stateCache.has(frame)) {
      debugLog(`Cache hit for frame ${frame}`);
      return deepCopy(this.stateCache.get(frame)!.state);
    }

    // 2. キャッシュとStateEvent両方から最も近いframeを探す
    let baseFrame = 0;
    let baseState: DesmosState | null = null;

    const cachedFrames = Array.from(this.stateCache.keys()).filter((f) => f <= frame);
    const stateEventFrames = this.stateEvents.map((e) => e.frame ?? 0).filter((f) => f <= frame);

    const candidateFrames: Array<{ frame: number; type: "cache" | "stateEvent" }> = [];
    if (cachedFrames.length > 0) {
      candidateFrames.push({ frame: Math.max(...cachedFrames), type: "cache" });
    }
    if (stateEventFrames.length > 0) {
      candidateFrames.push({ frame: Math.max(...stateEventFrames), type: "stateEvent" });
    }

    if (candidateFrames.length > 0) {
      // frameが大きい方（＝より近い方）を選択
      candidateFrames.sort((a, b) => b.frame - a.frame);
      const best = candidateFrames[0];
      baseFrame = best.frame;
      if (best.type === "cache") {
        const cache = this.stateCache.get(baseFrame)!;
        baseState = deepCopy(cache.state);
        debugLog(`Using cached state at frame ${baseFrame}`);
      } else {
        const stateEvent = this.stateEvents.find((e) => (e.frame ?? 0) === baseFrame)!;
        baseState = deepCopy(stateEvent.state);
        debugLog(`Using state event at frame ${baseFrame}`);
      }
    } else {
      baseState = getBlankDesmosState();
      baseFrame = 0;
      debugLog(`Using blank state as base`);
    }

    // 3. 計算用calculatorをbaseStateで初期化
    this.computeCalculator.setState(baseState);

    // 4. baseFrame以降、frameまでのイベントを適用
    // animationはbaseFrame以前から継続しているものも含める
    const allEvents = this.getEventsUpToFrame(frame);
    const eventsToApply: Array<UnifiedEvent | StateEvent> = [];
    for (const event of allEvents) {
      const eventFrame = event.frame ?? 0;
      // console.log("🚀", event);
      if (eventFrame > baseFrame) {
        eventsToApply.push(event);
      } else if (event.type === "animation" && event.animation && eventFrame <= baseFrame) {
        // animationの終了フレームがbaseFrame以降なら適用対象
        const animEndFrame = eventFrame + (event.animation.durationFrames ?? 0);
        if (animEndFrame >= baseFrame && animEndFrame > baseFrame) {
          eventsToApply.push(event);
        }
      }
    }
    debugLog(
      `Applying ${eventsToApply.length} events from frame ${baseFrame} to ${frame} (including ongoing animations)`
    );
    for (const event of eventsToApply) {
      if ("type" in event && event.type === "state") {
        await this.applyStateEventToComputeCalculator(event as StateEvent);
      } else {
        await this.applyUnifiedEventToComputeCalculator(event as UnifiedEvent);
      }
    }

    const state = this.computeCalculator.getState();

    // 5. スクリーンショット取得
    let width = 1920;
    let height = 1080;
    let targetPixelRatio = 1;
    let backgroundColor = "#fff";
    if (this._videoSettings) {
      if (this._videoSettings.resolution) {
        width = this._videoSettings.resolution.width ?? width;
        height = this._videoSettings.resolution.height ?? height;
      }
      if (this._videoSettings.advanced) {
        targetPixelRatio = this._videoSettings.advanced.targetPixelRatio ?? targetPixelRatio;
        backgroundColor = this._videoSettings.advanced.backgroundColor ?? backgroundColor;
      }
    }
    width = Math.round(width * targetPixelRatio);
    height = Math.round(height * targetPixelRatio);
    let screenshot: Promise<string> | undefined = undefined;
    if (this.computeCalculator && typeof this.computeCalculator.asyncScreenshot === "function") {
      screenshot = new Promise<string>((resolve) => {
        this.computeCalculator!.asyncScreenshot(
          { width, height, targetPixelRatio },
          (url: string) => {
            resolve(url);
          }
        );
      });
    }
    this.stateCache.set(frame, { state: deepCopy(state), screenshot });
    debugLog(`State and screenshot cached for frame ${frame}`);
    return deepCopy(state);
  }

  // 指定時刻の状態を表示用calculatorに適用
  async applyStateAtFrame(frame: number, displayCalculator: Calculator): Promise<void> {
    const state = await this.getStateAtFrame(frame);
    this.applyStateToCalculator(state, displayCalculator);
    debugLog(`State applied to display calculator at frame ${frame}`);
  }

  // 計算用calculatorを初期状態にリセット
  private async resetComputeCalculatorToInitialState(): Promise<void> {
    if (!this.computeCalculator) return;

    debugLog("Resetting compute calculator to blank state");
    if (this.computeCalculator) {
      this.computeCalculator.setState(getBlankDesmosState());
    }
  }

  // 指定時刻までのイベントを取得（アニメーションの進行状態も考慮）
  private getEventsUpToFrame(frame: number): Array<UnifiedEvent | StateEvent> {
    const events: Array<UnifiedEvent | StateEvent> = [];

    for (const stateEvent of this.stateEvents) {
      if ((stateEvent.frame ?? 0) <= frame) {
        events.push(stateEvent);
      }
    }

    for (const event of this.timeline) {
      if (event.type === "animation" && event.animation) {
        const animStartFrame = event.frame ?? 0;
        const animEndFrame = animStartFrame + (event.animation.durationFrames ?? 0);

        if (frame >= animStartFrame && frame <= animEndFrame) {
          const progress = (frame - animStartFrame) / (event.animation.durationFrames ?? 1);
          const animationEvent = this.createInterpolatedAnimationEvent(event, progress);
          events.push(animationEvent);
        } else if (frame > animEndFrame) {
          const animationEvent = this.createInterpolatedAnimationEvent(event, 1.0);
          events.push(animationEvent);
        }
      } else {
        if ((event.frame ?? 0) <= frame) {
          events.push(event);
        }
      }
    }

    return events.sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
  }

  // アニメーションの進行状態に基づいて補間されたイベントを作成
  private createInterpolatedAnimationEvent(
    originalEvent: UnifiedEvent,
    progress: number
  ): UnifiedEvent {
    if (!originalEvent.animation) return originalEvent;

    const animation = originalEvent.animation;
    const easedProgress = this.applyEasing(progress, animation.easing || "linear");

    // videoSettingsから解像度・ピクセル比を取得
    let width = 1920;
    let height = 1080;
    let pixelRatio = 1;
    if (this._videoSettings) {
      if (this._videoSettings.resolution) {
        width = this._videoSettings.resolution.width ?? width;
        height = this._videoSettings.resolution.height ?? height;
      }
      if (this._videoSettings.advanced) {
        pixelRatio = this._videoSettings.advanced.targetPixelRatio ?? pixelRatio;
      }
    }
    width = Math.round(width * pixelRatio);
    height = Math.round(height * pixelRatio);

    // 補間されたアニメーションイベントを作成
    const interpolatedEvent: UnifiedEvent = {
      ...originalEvent,
      animation: { ...animation, width, height, pixelRatio },
    };

    // アニメーションタイプに応じて値を補間
    if (animation.type === "variable" && animation.variable) {
      const { startValue, endValue } = animation.variable;
      const currentValue = startValue + (endValue - startValue) * easedProgress;

      interpolatedEvent.animation = {
        ...animation,
        variable: {
          ...animation.variable,
          startValue: currentValue,
          endValue: currentValue, // 現在の値を開始値と終了値の両方に設定
        },
      };
    } else if (animation.type === "property" && animation.property) {
      const { startValue, endValue } = animation.property;
      const currentValue = startValue + (endValue - startValue) * easedProgress;

      interpolatedEvent.animation = {
        ...animation,
        property: {
          ...animation.property,
          startValue: currentValue,
          endValue: currentValue,
        },
      };
    } else if (animation.type === "action" && animation.action) {
      // アクションアニメーションの場合は進行状態に応じてステップ数を調整
      const totalSteps = animation.action.steps;
      const currentSteps = Math.floor(totalSteps * easedProgress);

      interpolatedEvent.animation = {
        ...animation,
        action: {
          ...animation.action,
          steps: currentSteps,
        },
      };
    }

    return interpolatedEvent;
  }

  // イージング関数の適用
  private applyEasing(
    progress: number,
    easing: "linear" | "ease-in" | "ease-out" | "ease-in-out"
  ): number {
    switch (easing) {
      case "ease-in":
        return progress * progress;
      case "ease-out":
        return 1 - (1 - progress) * (1 - progress);
      case "ease-in-out":
        return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      case "linear":
      default:
        return progress;
    }
  }

  // StateEventを計算用calculatorに適用
  private async applyStateEventToComputeCalculator(stateEvent: StateEvent): Promise<void> {
    if (!this.computeCalculator) return;

    debugLog(`Applying state event at frame ${stateEvent.frame}`);
    this.applyStateToCalculator(stateEvent.state, this.computeCalculator);
  }

  // UnifiedEventを計算用calculatorに適用
  private async applyUnifiedEventToComputeCalculator(event: UnifiedEvent): Promise<void> {
    if (!this.computeCalculator) return;

    debugLog(`Applying unified event at frame ${event.frame}:`, event.type);
    // frameが未定義の場合は0として扱う

    switch (event.type) {
      case "expression":
        await this.applyExpressionEvent(event);
        break;
      case "bounds":
        await this.applyBoundsEvent(event);
        break;
      case "animation":
        await this.applyAnimationEvent(event);
        break;
      default:
        debugLog(`Unknown event type: ${event.type}`);
    }
  }

  // Expression イベントを適用
  private async applyExpressionEvent(event: UnifiedEvent): Promise<void> {
    if (!this.computeCalculator || event.type !== "expression") return;

    // 通常のExpression変更
    if (!event.properties) {
      debugLog("Warning: Expression event missing expressionId or properties");
      return;
    }
    try {
      this.computeCalculator.setExpression(event.properties);
      debugLog(`Created new expression ${event}:`);
    } catch (error) {
      debugLog(`Error creating expression ${event}:`, error);
    }
  }

  // Bounds イベントを適用
  private async applyBoundsEvent(event: UnifiedEvent): Promise<void> {
    if (!this.computeCalculator || event.type !== "bounds" || !event.bounds) return;

    try {
      this.computeCalculator.setMathBounds({
        left: event.bounds.left,
        right: event.bounds.right,
        top: event.bounds.top,
        bottom: event.bounds.bottom,
      });
      debugLog(`Applied bounds:`, event.bounds);
    } catch (error) {
      debugLog(`Error applying bounds:`, error);
    }
  }

  // Animation イベントを適用（補間済みの値を使用）
  private async applyAnimationEvent(event: UnifiedEvent): Promise<void> {
    if (!this.computeCalculator || event.type !== "animation" || !event.animation) return;

    const animation = event.animation;

    try {
      // 変数アニメーションの場合
      if (animation.type === "variable" && animation.variable) {
        const { name, startValue } = animation.variable; // 補間済みなので startValue を使用
        const targetId = animation.targetId;

        if (targetId) {
          // 自動検出の場合、対象expressionから変数名を取得して値を設定
          // 実装時にはDesmosから実際のLaTeX式を取得して変数名を抽出する必要がある
          this.computeCalculator.setExpression({
            id: targetId,
            latex: `${
              this.computeCalculator
                .getExpressions()
                .find((expr) => expr.id === targetId)
                ?.latex?.split("=")[0]
                .trim() || name
            } = ${startValue}`,
          });
        } else {
          // 手動指定の場合
          this.computeCalculator.setExpression({
            id: `__animation_${name}`,
            latex: `${name} = ${startValue}`,
          });
        }
        debugLog(`Applied variable animation: ${name} = ${startValue}`);
      }

      // プロパティアニメーションの場合
      else if (animation.type === "property" && animation.property) {
        const { name, startValue } = animation.property; // 補間済みなので startValue を使用
        const targetId = animation.targetId;

        // 対象expressionのプロパティを更新
        this.computeCalculator.setExpression({
          id: targetId,
          [name]: startValue,
        });
        debugLog(`Applied property animation: ${targetId}.${name} = ${startValue}`);
      }

      // アクションアニメーションの場合
      else if (animation.type === "action" && animation.action) {
        const { steps } = animation.action; // 補間済みのステップ数
        const targetId = animation.targetId;
        console.log(this.computeCalculator.getExpressions());
        // 指定回数アクションを実行
        for (let i = 0; i < steps; i++) {
          // FIXME: アクションがどうしても実行されない
          // コードの実行自体はされている
          this.computeCalculator.controller.dispatch({
            type: "action-single-step",
            id: targetId,
          });
          debugLog(`Action step ${i + 1}/${steps} for ${targetId}`);
        }
        await new Promise<void>((resolve) => {
          this.computeCalculator!.controller.evaluator.notifyWhenSynced(() => {
            resolve();
          });
        });
        debugLog(`Applied action animation: ${targetId} executed ${steps} steps`);
        console.log(this.computeCalculator.getExpressions());
      }
    } catch (error) {
      debugLog(`Error applying animation:`, error);
    }
  }

  // StateをCalculatorに適用
  applyStateToCalculator(state: DesmosState, calculator: Calculator): void {
    try {
      calculator.setState(state);
      debugLog(`Applied state with ${state.expressions?.list?.length || 0} expressions`);
    } catch (error) {
      console.error("Error applying state to calculator:", error);
    }
  }

  // イベントを追加
  addEvent(event: UnifiedEvent): void {
    debugLog(`Adding event:`, event);
    debugLog(`Timeline before add - length: ${this.timeline.length}`);

    this.timeline.push(event);
    this.timeline.sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
    this.clearCache();

    debugLog(`Timeline after add - length: ${this.timeline.length}`);
    debugLog(`Added event at frame ${event.frame}`);
    // frameが未定義の場合は0として扱う
  }

  // イベントを更新
  updateEvent(eventId: string, updates: Partial<UnifiedEvent>): boolean {
    const index = this.timeline.findIndex((event) => event.id === eventId);
    if (index === -1) {
      debugLog(`Event not found for update: ${eventId}`);
      return false;
    }

    debugLog(`Before update - Event ${eventId}:`, this.timeline[index]);
    debugLog(`Update data:`, updates);

    this.timeline[index] = { ...this.timeline[index], ...updates };

    debugLog(`After update - Event ${eventId}:`, this.timeline[index]);

    // 時刻が変更された場合はソート
    if (updates.frame !== undefined) {
      this.timeline.sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
    }

    this.clearCache();
    debugLog(`Updated event ${eventId}, timeline length: ${this.timeline.length}`);
    return true;
  }

  // イベントを削除
  removeEvent(eventId: string): boolean {
    const initialLength = this.timeline.length;
    this.timeline = this.timeline.filter((event) => event.id !== eventId);

    if (this.timeline.length < initialLength) {
      this.clearCache();
      debugLog(`Removed event ${eventId}`);
      return true;
    }

    return false;
  }

  // タイムラインをクリア
  clearTimeline(): void {
    this.timeline = [];
    this.clearCache();
    debugLog("Timeline cleared");
  }

  // StateEventを追加
  addStateEvent(stateEvent: StateEvent): void {
    if (stateEvent.frame < 0) return;
    this.stateEvents.push(stateEvent);
    this.stateEvents.sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
    this.clearCache();
    debugLog(`Added state event at frame ${stateEvent.frame}`);
  }

  // StateEventをクリア
  clearStateEvents(): void {
    this.stateEvents = [];
    this.clearCache();
    debugLog("State events cleared");
  }

  // 現在のcalculatorの状態からStateEventを作成
  createStateEventFromCalculator(
    frame: number,
    calculator: Calculator,
    description?: string
  ): StateEvent {
    const currentState = calculator.getState();
    const stateEvent: StateEvent = {
      frame,
      type: "state",
      state: deepCopy(currentState),
      id: `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: description || `State at frame ${frame}`,
    };

    this.addStateEvent(stateEvent);
    return stateEvent;
  }

  // キャッシュをクリア
  clearCache(): void {
    this.stateCache.clear();
    debugLog("Cache cleared");
  }

  // 初期状態更新機能は廃止

  // タイムラインを取得
  getTimeline(): UnifiedEvent[] {
    return [...this.timeline];
  }

  // StateEventsを取得
  getStateEvents(): StateEvent[] {
    return [...this.stateEvents];
  }

  // デバッグ情報を取得
  getDebugInfo() {
    return {
      timelineEvents: this.timeline.length,
      stateEvents: this.stateEvents.length,
      cachedStates: this.stateCache.size,
      cachedTimes: Array.from(this.stateCache.keys()).sort((a, b) => a - b),
      cachedScreenshots: Array.from(this.stateCache.values()).filter((v) => v.screenshot).length,
      computeCalculatorSet: !!this.computeCalculator,
    };
  }
  // 指定時刻のスクリーンショットを取得
  async getScreenshotAtFrame(frame: number): Promise<string | undefined> {
    return await this.stateCache.get(frame)?.screenshot;
  }

  // 特定の時刻での計算過程をデバッグ
  async debugStateCalculation(frame: number): Promise<{
    eventsApplied: Array<UnifiedEvent | StateEvent>;
    finalState: DesmosState;
  }> {
    if (!this.computeCalculator) {
      throw new Error("Compute calculator not set");
    }

    debugLog(`=== Debug state calculation for frame ${frame} ===`);

    await this.resetComputeCalculatorToInitialState();
    debugLog("Reset to initial state");

    const eventsApplied = this.getEventsUpToFrame(frame);
    debugLog(
      `Events to apply (${eventsApplied.length}):`,
      eventsApplied.map((e) => ({
        frame: "frame" in e ? e.frame : undefined,
        type: e.type,
        id: "id" in e ? e.id : undefined,
      }))
    );

    for (const event of eventsApplied) {
      debugLog(`Applying event at ${"frame" in event ? event.frame : undefined}:`, event);

      if (event.type === "state") {
        await this.applyStateEventToComputeCalculator(event as StateEvent);
      } else {
        await this.applyUnifiedEventToComputeCalculator(event as UnifiedEvent);
      }

      const expressions = this.computeCalculator.getExpressions();
      debugLog(`After applying event - expressions count: ${expressions.length}`);
    }

    const finalState = this.computeCalculator.getState();
    debugLog(`Final state has ${finalState.expressions?.list?.length || 0} expressions`);

    debugLog("=== End debug ===");

    return {
      eventsApplied,
      finalState: deepCopy(finalState),
    };
  }
}

// StateManagerのシングルトンインスタンス
let stateManagerInstance: StateManager | null = null;

export function createStateManager(
  timeline: UnifiedEvent[] = [],
  stateEvents: StateEvent[] = [],
  continuousEvents: ContinuousEvent[] = []
): StateManager {
  stateManagerInstance = new StateManager(timeline, stateEvents, continuousEvents);
  return stateManagerInstance;
}

export function getStateManager(): StateManager | null {
  return stateManagerInstance;
}
