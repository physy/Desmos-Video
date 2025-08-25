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
import type { StateEvent, ContinuousEvent, UnifiedEvent } from "../types/timeline";
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
  // 指定時刻のスクリーンショットをキャッシュに保存
  setScreenshotAtTime(time: number, screenshot: string) {
    const cache = this.stateCache.get(time);
    if (cache) {
      cache.screenshot = screenshot;
    } else {
      // 状態が未計算の場合は空のstateで保存
      this.stateCache.set(time, { state: getBlankDesmosState(), screenshot });
    }
  }
  // ...existing code...

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
  // initialState削除
  private timeline: UnifiedEvent[];
  private stateEvents: StateEvent[];
  private continuousEvents: ContinuousEvent[];

  // 計算用calculator（非表示、state計算専用）
  private computeCalculator: Calculator | null = null;

  // 状態キャッシュ（DesmosStateとスクリーンショット）
  private stateCache: Map<number, { state: DesmosState; screenshot?: string }> = new Map();

  constructor(
    timeline: UnifiedEvent[] = [],
    stateEvents: StateEvent[] = [],
    continuousEvents: ContinuousEvent[] = []
  ) {
    this.timeline = [...timeline].sort((a, b) => a.time - b.time);
    this.stateEvents = [...stateEvents].sort((a, b) => a.time - b.time);
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
  async getStateAtTime(time: number): Promise<DesmosState> {
    if (!this.computeCalculator) {
      throw new Error("Compute calculator not set. Call setComputeCalculator() first.");
    }

    // キャッシュチェック
    if (this.stateCache.has(time)) {
      debugLog(`Cache hit for time ${time}`);
      return deepCopy(this.stateCache.get(time)!.state);
    }

    debugLog(`Computing state at time ${time}`);

    // 1. 計算用calculatorを初期状態にリセット
    await this.resetComputeCalculatorToInitialState();

    // 2. 指定時刻までのイベントを時系列順に適用
    const eventsUpToTime = this.getEventsUpToTime(time);
    console.log({ eventsUpToTime });
    debugLog(`Applying ${eventsUpToTime.length} events up to time ${time}`);

    for (const event of eventsUpToTime) {
      if ("type" in event && event.type === "state") {
        // StateEvent の処理
        await this.applyStateEventToComputeCalculator(event as StateEvent);
      } else {
        // UnifiedEvent の処理
        await this.applyUnifiedEventToComputeCalculator(event as UnifiedEvent);
      }
    }

    // 3. 現在の状態を取得
    const state = this.computeCalculator.getState();

    // 4. スクリーンショットを取得（APIがあれば）
    let screenshot: string | undefined = undefined;
    if (typeof (this.computeCalculator as any).getScreenshot === "function") {
      try {
        screenshot = await (this.computeCalculator as any).getScreenshot();
      } catch (e) {
        debugLog("Screenshot capture failed:", e);
      }
    }

    // 5. キャッシュに保存
    this.stateCache.set(time, { state: deepCopy(state), screenshot });

    debugLog(`State and screenshot cached for time ${time}`);
    return deepCopy(state);
  }

  // 指定時刻の状態を表示用calculatorに適用
  async applyStateAtTime(time: number, displayCalculator: Calculator): Promise<void> {
    const state = await this.getStateAtTime(time);
    this.applyStateToCalculator(state, displayCalculator);
    debugLog(`State applied to display calculator at time ${time}`);
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
  private getEventsUpToTime(time: number): Array<UnifiedEvent | StateEvent> {
    const events: Array<UnifiedEvent | StateEvent> = [];

    // StateEventsを追加（指定時刻以前）
    for (const stateEvent of this.stateEvents) {
      if (stateEvent.time <= time) {
        events.push(stateEvent);
      }
    }

    // UnifiedEventsを追加（アニメーションは特別処理）
    for (const event of this.timeline) {
      if (event.type === "animation" && event.animation) {
        // アニメーションイベントは特別処理
        const animStartTime = event.time;
        const animEndTime = event.time + event.animation.duration;

        if (time >= animStartTime && time <= animEndTime) {
          // アニメーション実行中：進行状態を計算して適用
          const progress = (time - animStartTime) / event.animation.duration;
          const animationEvent = this.createInterpolatedAnimationEvent(event, progress);
          events.push(animationEvent);
        } else if (time > animEndTime) {
          // アニメーション完了：最終値を適用
          const animationEvent = this.createInterpolatedAnimationEvent(event, 1.0);
          events.push(animationEvent);
        }
        // time < animStartTime の場合は何もしない（アニメーション未開始）
      } else {
        // 通常のイベント
        if (event.time <= time) {
          events.push(event);
        }
      }
    }

    // 時系列順にソート
    return events.sort((a, b) => a.time - b.time);
  }

  // アニメーションの進行状態に基づいて補間されたイベントを作成
  private createInterpolatedAnimationEvent(
    originalEvent: UnifiedEvent,
    progress: number
  ): UnifiedEvent {
    if (!originalEvent.animation) return originalEvent;

    const animation = originalEvent.animation;
    const easedProgress = this.applyEasing(progress, animation.easing || "linear");

    // 補間されたアニメーションイベントを作成
    const interpolatedEvent: UnifiedEvent = {
      ...originalEvent,
      animation: { ...animation },
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

    debugLog(`Applying state event at time ${stateEvent.time}`);
    this.applyStateToCalculator(stateEvent.state, this.computeCalculator);
  }

  // UnifiedEventを計算用calculatorに適用
  private async applyUnifiedEventToComputeCalculator(event: UnifiedEvent): Promise<void> {
    if (!this.computeCalculator) return;

    debugLog(`Applying unified event at time ${event.time}:`, event.type);

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

        // 指定回数アクションを実行
        for (let i = 0; i < steps; i++) {
          // FIXME: アクションがどうしても実行されない
          // コードの実行自体はされている
          this.computeCalculator.controller.dispatch({ type: "action-single-step", id: targetId });
          debugLog(`Action step ${i + 1}/${steps} for ${targetId}`);
        }
        debugLog(`Applied action animation: ${targetId} executed ${steps} steps`);
      }
    } catch (error) {
      debugLog(`Error applying animation:`, error);
    }
  }

  // StateをCalculatorに適用
  private applyStateToCalculator(state: DesmosState, calculator: Calculator): void {
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
    this.timeline.sort((a, b) => a.time - b.time);
    this.clearCache();

    debugLog(`Timeline after add - length: ${this.timeline.length}`);
    debugLog(`Added event at time ${event.time}`);
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
    if (updates.time !== undefined) {
      this.timeline.sort((a, b) => a.time - b.time);
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
    this.stateEvents.push(stateEvent);
    this.stateEvents.sort((a, b) => a.time - b.time);
    this.clearCache();
    debugLog(`Added state event at time ${stateEvent.time}`);
  }

  // StateEventをクリア
  clearStateEvents(): void {
    this.stateEvents = [];
    this.clearCache();
    debugLog("State events cleared");
  }

  // 現在のcalculatorの状態からStateEventを作成
  createStateEventFromCalculator(
    time: number,
    calculator: Calculator,
    description?: string
  ): StateEvent {
    const currentState = calculator.getState();
    const stateEvent: StateEvent = {
      time,
      type: "state",
      state: deepCopy(currentState),
      id: `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: description || `State at ${time}s`,
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
  getScreenshotAtTime(time: number): string | undefined {
    return this.stateCache.get(time)?.screenshot;
  }

  // 特定の時刻での計算過程をデバッグ
  async debugStateCalculation(time: number): Promise<{
    eventsApplied: Array<UnifiedEvent | StateEvent>;
    finalState: DesmosState;
  }> {
    if (!this.computeCalculator) {
      throw new Error("Compute calculator not set");
    }

    debugLog(`=== Debug state calculation for time ${time} ===`);

    // 計算用calculatorを初期状態にリセット
    await this.resetComputeCalculatorToInitialState();
    debugLog("Reset to initial state");

    // 適用するイベントを取得
    const eventsApplied = this.getEventsUpToTime(time);
    debugLog(
      `Events to apply (${eventsApplied.length}):`,
      eventsApplied.map((e) => ({ time: e.time, type: e.type, id: e.id }))
    );

    // 各イベントを適用
    for (const event of eventsApplied) {
      debugLog(`Applying event at ${event.time}:`, event);

      if ("type" in event && event.type === "state") {
        // StateEvent の処理
        await this.applyStateEventToComputeCalculator(event as StateEvent);
      } else {
        // UnifiedEvent の処理
        await this.applyUnifiedEventToComputeCalculator(event as UnifiedEvent);
      }

      // 適用後の式の状態をログ
      const expressions = this.computeCalculator.getExpressions();
      debugLog(`After applying event - expressions count: ${expressions.length}`);
    }

    // 最終状態を取得
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
