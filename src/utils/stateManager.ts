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
import type { StateEvent, UnifiedEvent, VideoExportSettings } from "../types/timeline";
import { deepCopy } from "./deepCopy";
import { DEFAULT_VIDEO_SETTINGS } from "./videoSettingsDefaults";

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
  private _videoSettings: VideoExportSettings;

  // videoSettingsのgetter/setter
  public get videoSettings(): VideoExportSettings {
    return this._videoSettings;
  }
  public set videoSettings(settings: VideoExportSettings) {
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

  // 計算用calculator（非表示、state計算専用）
  private computeCalculator: Calculator | null = null;

  // 評価専用calculator（時間のかかる計算用、actionアニメーション専用）
  private evaluationCalculator: Calculator | null = null;
  private isEvaluating: boolean = false;

  // スクリーンショット専用calculator
  private screenshotCalculator: Calculator | null = null;
  private isScreenshotting: boolean = false;

  // actionアニメーションの結果キャッシュ
  // actionCache[stateHash][expressionId] = [step0State, step1State, step2State, ...]
  private actionCache: Record<string, Record<string, DesmosState[]>> = {};

  // 状態キャッシュ（DesmosStateとスクリーンショット）
  private stateCache: Map<number, { state: DesmosState; screenshot?: Promise<string> }> = new Map();

  constructor(timeline: UnifiedEvent[] = [], stateEvents: StateEvent[] = []) {
    this.timeline = [...timeline].sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
    this.stateEvents = [...stateEvents].sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
    this._videoSettings = DEFAULT_VIDEO_SETTINGS; // デフォルト値で初期化

    debugLog("StateManagerV2 initialized with:", {
      timelineEvents: this.timeline.length,
      stateEvents: this.stateEvents.length,
      defaultVideoSettings: this._videoSettings,
    });
  }

  // 計算用calculatorを設定
  setComputeCalculator(calculator: Calculator): void {
    this.computeCalculator = calculator;
    debugLog("Compute calculator set");
  }

  // 評価専用calculatorを設定
  setEvaluationCalculator(calculator: Calculator): void {
    this.evaluationCalculator = calculator;
    debugLog("Evaluation calculator set");
  }

  // スクリーンショット専用calculatorを設定
  setScreenshotCalculator(calculator: Calculator): void {
    this.screenshotCalculator = calculator;
    debugLog("Screenshot calculator set");
  }

  // スクリーンショット専用calculator取得用getter
  public getScreenshotCalculator(): Calculator | null {
    // destroy済みかどうか判定（簡易: getStateが例外を投げる場合）
    try {
      if (this.screenshotCalculator) {
        // getStateを呼んでみてエラーならdestroy済み
        this.screenshotCalculator.getState();
        return this.screenshotCalculator;
      }
    } catch (e) {
      // destroy済み
      return null;
    }
    return null;
  }

  // 評価中かどうかを取得
  isEvaluationInProgress(): boolean {
    return this.isEvaluating;
  }

  // スクリーンショット中かどうかを取得
  isScreenshottingInProgress(): boolean {
    return this.isScreenshotting;
  }

  // DesmosStateのハッシュを生成（actionキャッシュのキー用）
  private generateStateHash(state: DesmosState): string {
    // 重要な部分のみを抽出してハッシュ化（パフォーマンス向上のため）
    const hashData = {
      version: state.version,
      randomSeed: state.randomSeed,
      viewport: state.graph.viewport,
      expressions: state.expressions.list.map((expr) => ({
        id: expr.id,
        latex: expr.latex,
        // 他の重要なプロパティがあれば追加
      })),
    };

    // 簡易ハッシュ関数（JSON文字列のハッシュ）
    const jsonString = JSON.stringify(hashData);
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash.toString();
  }

  // 指定時刻の状態とスクリーンショットを計算して取得
  async getStateAtFrame(frame: number, getScreenshot: boolean = true): Promise<DesmosState> {
    if (!this.computeCalculator) {
      throw new Error("Compute calculator not set. Call setComputeCalculator() first.");
    }

    // 1. まずキャッシュを確認
    if (this.stateCache.has(frame)) {
      debugLog(`Cache hit for frame ${frame}`);
      return deepCopy(this.stateCache.get(frame)!.state);
    }

    // 2. 安全なbaseFrameを見つける（アニメーションの途中を避ける）
    const { baseFrame, baseState } = await this.findSafeBaseFrame(frame);

    // 3. 計算用calculatorをbaseStateで初期化
    this.computeCalculator.setState(baseState);

    // 4. baseFrame以降、frameまでのイベントを適用
    const allEvents = this.getEventsUpToFrame(frame);
    const eventsToApply: Array<UnifiedEvent | StateEvent> = [];
    for (const event of allEvents) {
      const eventFrame = event.frame ?? 0;
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

    let state = baseState;
    for (const event of eventsToApply) {
      if ("type" in event && event.type !== "state") {
        state = await this.applyUnifiedEvent(event as UnifiedEvent, state);
      } else {
        state = event.state;
      }
    }

    if (getScreenshot) {
      // 5. スクリーンショット取得
      let width = 1920;
      let height = 1080;
      let targetPixelRatio = 1;
      let backgroundColor = "#fff";
      if (this._videoSettings.resolution) {
        width = this._videoSettings.resolution.width ?? width;
        height = this._videoSettings.resolution.height ?? height;
      }
      if (this._videoSettings.advanced) {
        targetPixelRatio = this._videoSettings.advanced.targetPixelRatio ?? targetPixelRatio;
        backgroundColor = this._videoSettings.advanced.backgroundColor ?? backgroundColor;
      }
      width = Math.round(width * targetPixelRatio);
      height = Math.round(height * targetPixelRatio);
      let screenshot: Promise<string> | undefined = undefined;

      // スクリーンショット専用calculatorを使用
      if (
        this.screenshotCalculator &&
        typeof this.screenshotCalculator.asyncScreenshot === "function"
      ) {
        screenshot = this.getScreenshotWithDedicatedCalculator(
          state,
          width,
          height,
          targetPixelRatio
        );
      } else if (
        this.computeCalculator &&
        typeof this.computeCalculator.asyncScreenshot === "function"
      ) {
        debugLog("Warning: Using compute calculator for screenshot");
        // フォールバック: スクショ専用calculatorが無い場合は計算用calculatorを使用
        screenshot = new Promise<string>((resolve) => {
          this.computeCalculator!.setState(state);
          this.computeCalculator!.controller.evaluator.notifyWhenSynced(() => {
            this.computeCalculator!.controller.getGrapher().asyncScreenshot(
              { width, height, showLabels: true, targetPixelRatio },
              (url: string) => resolve(url)
            );
          });
        });
      }
      this.stateCache.set(frame, { state: deepCopy(state), screenshot });
      debugLog(`State and screenshot cached for frame ${frame}`);
    } else {
      this.stateCache.set(frame, { state: deepCopy(state), screenshot: undefined });
      debugLog(`State cached for frame ${frame}`);
    }
    return deepCopy(state);
  }

  // スクリーンショット専用calculatorでスクリーンショットを取得（パブリック）
  async getScreenshotWithDedicatedCalculator(
    state: DesmosState,
    width: number,
    height: number,
    targetPixelRatio: number
  ): Promise<string> {
    if (!this.screenshotCalculator) {
      throw new Error("Screenshot calculator not set");
    }

    if (this.isScreenshotting) {
      debugLog("Warning: Another screenshot operation is already in progress, waiting...");
      // スクリーンショット中の場合は完了まで待機
      while (this.isScreenshotting) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    try {
      this.isScreenshotting = true;
      debugLog(`Started screenshot operation: ${width}x${height}, pixelRatio=${targetPixelRatio}`);

      return new Promise<string>((resolve, reject) => {
        try {
          this.screenshotCalculator!.setState(state);
          this.screenshotCalculator!.controller.evaluator.notifyWhenSynced(() => {
            this.screenshotCalculator!.controller.getGrapher().asyncScreenshot(
              { width, height, showLabels: true, targetPixelRatio },
              (url: string) => {
                debugLog(`Screenshot completed successfully`);
                resolve(url);
              }
            );
          });
        } catch (error) {
          debugLog(`Error during screenshot operation:`, error);
          reject(error);
        }
      });
    } finally {
      this.isScreenshotting = false;
      debugLog("Screenshot operation completed, flag reset");
    }
  }

  // 安全なbaseFrame（アニメーション途中を避ける）を再帰的に見つける
  private async findSafeBaseFrame(
    targetFrame: number,
    excludedFrames: Set<number> = new Set()
  ): Promise<{ baseFrame: number; baseState: DesmosState }> {
    debugLog(`Finding safe base frame for target frame ${targetFrame}`);

    // キャッシュとStateEventから候補を探す
    const cachedFrames = Array.from(this.stateCache.keys()).filter(
      (f) => f <= targetFrame && !excludedFrames.has(f)
    );
    const stateEventFrames = this.stateEvents
      .map((e) => e.frame ?? 0)
      .filter((f) => f <= targetFrame && !excludedFrames.has(f));

    const candidateFrames: Array<{ frame: number; type: "cache" | "stateEvent" }> = [];
    if (cachedFrames.length > 0) {
      candidateFrames.push({ frame: Math.max(...cachedFrames), type: "cache" });
    }
    if (stateEventFrames.length > 0) {
      candidateFrames.push({ frame: Math.max(...stateEventFrames), type: "stateEvent" });
    }

    // 候補がない場合は初期状態を使用
    if (candidateFrames.length === 0) {
      debugLog(`No candidates found, using blank state as base`);
      return { baseFrame: 0, baseState: getBlankDesmosState() };
    }

    // frameが大きい方（＝より近い方）を選択
    candidateFrames.sort((a, b) => b.frame - a.frame);
    const candidate = candidateFrames[0];
    const candidateFrame = candidate.frame;

    debugLog(`Checking candidate frame ${candidateFrame}`);

    // アニメーションの途中かどうかをチェック
    const conflictingAnimation = this.findConflictingAnimation(candidateFrame, targetFrame);
    if (conflictingAnimation) {
      debugLog(
        `Frame ${candidateFrame} is in the middle of animation starting at ${conflictingAnimation.frame}, ` +
          `recursively finding earlier base frame`
      );

      // このframeを除外して再帰的に探す
      excludedFrames.add(candidateFrame);
      return this.findSafeBaseFrame(targetFrame, excludedFrames);
    }

    // 安全なframeが見つかった場合、状態を取得
    let baseState: DesmosState;
    if (candidate.type === "cache") {
      const cache = this.stateCache.get(candidateFrame)!;
      baseState = deepCopy(cache.state);
      debugLog(`Using cached state at frame ${candidateFrame}`);
    } else {
      const stateEvent = this.stateEvents.find((e) => (e.frame ?? 0) === candidateFrame)!;
      baseState = deepCopy(stateEvent.state);
      debugLog(`Using state event at frame ${candidateFrame}`);
    }
    return { baseFrame: candidateFrame, baseState };
  }

  // 指定フレームがアニメーションの途中にあるかチェック
  private findConflictingAnimation(
    candidateFrame: number,
    targetFrame: number
  ): UnifiedEvent | null {
    for (const event of this.timeline) {
      if (event.type === "animation" && event.animation) {
        const animStartFrame = event.frame ?? 0;
        const animEndFrame = animStartFrame + (event.animation.durationFrames ?? 0);

        // candidateFrameがアニメーションの途中（開始フレームより後、終了フレーム以前）にある場合
        if (
          candidateFrame > animStartFrame &&
          candidateFrame <= animEndFrame &&
          targetFrame <= animEndFrame
        ) {
          return event;
        }
      }
    }
    return null;
  }

  // 指定時刻の状態を表示用calculatorに適用
  async applyStateAtFrame(
    frame: number,
    displayCalculator: Calculator,
    getScreenshot: boolean = true
  ): Promise<void> {
    const state = await this.getStateAtFrame(frame, getScreenshot);
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
    if (this._videoSettings.resolution) {
      width = this._videoSettings.resolution.width ?? width;
      height = this._videoSettings.resolution.height ?? height;
    }
    if (this._videoSettings.advanced) {
      pixelRatio = this._videoSettings.advanced.targetPixelRatio ?? pixelRatio;
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
    } else if (animation.type === "bounds" && animation.bounds) {
      // バウンズアニメーションの補間処理
      const boundsAnimation = { ...animation.bounds };

      // スケールアニメーション
      if (boundsAnimation.scale) {
        // 開始値1.0から終了値まで補間
        const currentScale = 1.0 + (boundsAnimation.scale.endValue - 1.0) * easedProgress;
        boundsAnimation.scale = {
          endValue: currentScale,
          centerX: boundsAnimation.scale.centerX,
          centerY: boundsAnimation.scale.centerY,
        };
      }

      // 並進移動アニメーション
      if (boundsAnimation.translation) {
        // 開始値0から終了値まで補間
        const currentX = boundsAnimation.translation.endX * easedProgress;
        const currentY = boundsAnimation.translation.endY * easedProgress;
        boundsAnimation.translation = {
          endX: currentX,
          endY: currentY,
          mode: boundsAnimation.translation.mode,
        };
      }

      // 直接的なバウンズ指定（この場合は開始バウンズが必要なため、実装を見直す必要がある）
      if (boundsAnimation.direct) {
        // 注意: direct modeの場合、開始バウンズが必要だが現在の型定義にはない
        // ここでは終了値をそのまま使用（実際には開始時の状態から補間すべき）
        boundsAnimation.direct = {
          endBounds: boundsAnimation.direct.endBounds,
        };
      }

      interpolatedEvent.animation = {
        ...animation,
        bounds: boundsAnimation,
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

  // UnifiedEventを適用
  private async applyUnifiedEvent(
    event: UnifiedEvent,
    previousState: DesmosState
  ): Promise<DesmosState> {
    if (!this.computeCalculator) return previousState;

    debugLog(`Applying unified event at frame ${event.frame}:`, event.type);
    switch (event.type) {
      case "expression":
        return await this.applyExpressionEvent(event, previousState);
      case "bounds":
        return await this.applyBoundsEvent(event, previousState);
      case "animation":
        return await this.applyAnimationEvent(event, previousState);
      default:
        debugLog(`Unknown event type: ${event.type}`);
        return previousState;
    }
  }

  // Expression イベントを適用
  private async applyExpressionEvent(
    event: UnifiedEvent,
    previousState: DesmosState
  ): Promise<DesmosState> {
    if (!this.computeCalculator || event.type !== "expression") return previousState;
    this.computeCalculator.setState(previousState);

    // 通常のExpression変更
    if (!event.properties) {
      debugLog("Warning: Expression event missing expressionId or properties");
      return previousState;
    }
    try {
      this.computeCalculator.setExpression({
        ...event.properties,
        sliderBounds: { min: undefined, max: undefined },
      });
      debugLog(`Created new expression ${event}:`);
    } catch (error) {
      debugLog(`Error creating expression ${event}:`, error);
    }
    return this.computeCalculator.getState();
  }

  // Bounds イベントを適用
  private async applyBoundsEvent(
    event: UnifiedEvent,
    previousState: DesmosState
  ): Promise<DesmosState> {
    if (!this.computeCalculator || event.type !== "bounds" || !event.bounds) return previousState;
    this.computeCalculator.setState(previousState);

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
    return this.computeCalculator.getState();
  }

  // Animation イベントを適用（補間済みの値を使用）
  private async applyAnimationEvent(
    event: UnifiedEvent,
    previousState: DesmosState
  ): Promise<DesmosState> {
    if (!this.computeCalculator || event.type !== "animation" || !event.animation)
      return previousState;
    this.computeCalculator.setState(previousState);

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
            sliderBounds: { min: undefined, max: undefined },
          });
        } else {
          // 手動指定の場合
          this.computeCalculator.setExpression({
            id: `__animation_${name}`,
            latex: `${name} = ${startValue}`,
            sliderBounds: { min: undefined, max: undefined },
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
          sliderBounds: { min: undefined, max: undefined },
        });
        debugLog(`Applied property animation: ${targetId}.${name} = ${startValue}`);
      }

      // アクションアニメーションの場合
      else if (animation.type === "action" && animation.action) {
        return await this.applyActionAnimation(animation, previousState);
      }

      // バウンズアニメーションの場合
      else if (animation.type === "bounds" && animation.bounds) {
        return await this.applyBoundsAnimation(animation.bounds, previousState);
      }
    } catch (error) {
      debugLog(`Error applying animation:`, error);
    }

    return this.computeCalculator.getState();
  }

  // アクションアニメーションの適用（専用calculator使用、キャッシュ対応）
  private async applyActionAnimation(
    animation: NonNullable<UnifiedEvent["animation"]>,
    previousState: DesmosState
  ): Promise<DesmosState> {
    if (!this.evaluationCalculator || !animation.action) {
      debugLog("Warning: Evaluation calculator not set or action config missing");
      return previousState;
    }

    if (this.isEvaluating) {
      debugLog("Warning: Another action evaluation is already in progress, waiting...");
      // 評価中の場合は完了まで待機
      while (this.isEvaluating) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const { steps } = animation.action; // 補間済みのステップ数
    const targetId = animation.targetId;
    const stateHash = this.generateStateHash(previousState);

    // キャッシュをチェック
    if (
      this.actionCache[stateHash] &&
      this.actionCache[stateHash][targetId] &&
      this.actionCache[stateHash][targetId][steps]
    ) {
      debugLog(`Action cache hit: hash=${stateHash}, id=${targetId}, steps=${steps}`);
      return deepCopy(this.actionCache[stateHash][targetId][steps]);
    }

    try {
      this.isEvaluating = true;
      debugLog(`Started action evaluation: hash=${stateHash}, id=${targetId}, steps=${steps}`);

      // 専用calculatorに状態を設定
      this.evaluationCalculator.setState(previousState);

      // キャッシュの初期化
      if (!this.actionCache[stateHash]) {
        this.actionCache[stateHash] = {};
      }
      if (!this.actionCache[stateHash][targetId]) {
        this.actionCache[stateHash][targetId] = [];
        // step 0 (初期状態)をキャッシュに保存
        this.actionCache[stateHash][targetId][0] = deepCopy(previousState);
      }

      // 既存のキャッシュがある場合、最後にキャッシュされた状態から開始
      const cachedStates = this.actionCache[stateHash][targetId];
      const lastCachedStep = cachedStates.length - 1;
      let currentState = previousState;

      if (lastCachedStep > 0) {
        // 最後にキャッシュされた状態から再開
        currentState = deepCopy(cachedStates[lastCachedStep]);
        this.evaluationCalculator.setState(currentState);
        debugLog(`Resuming from cached step ${lastCachedStep}`);
      }

      // 評価の完了を待つ
      await new Promise<void>((resolve) => {
        this.evaluationCalculator!.controller.evaluator.notifyWhenSynced(() => {
          resolve();
        });
      });

      console.log(
        `before action (step ${lastCachedStep}):`,
        this.evaluationCalculator.getExpressions()
      );

      // 必要な分だけアクションを実行（キャッシュされていない部分のみ）
      for (let i = lastCachedStep; i < steps; i++) {
        this.evaluationCalculator.controller.dispatch({
          type: "action-single-step",
          id: targetId,
        });

        // 評価の完了を待つ
        await new Promise<void>((resolve) => {
          this.evaluationCalculator!.controller.evaluator.notifyWhenSynced(() => {
            resolve();
          });
        });

        // 新しい状態をキャッシュに保存
        const newState = this.evaluationCalculator.getState();
        this.actionCache[stateHash][targetId][i + 1] = deepCopy(newState);

        debugLog(`Action step ${i + 1}/${steps} for ${targetId} completed and cached`);
      }

      console.log(`after action (step ${steps}):`, this.evaluationCalculator.getExpressions());
      debugLog(`Action animation completed and cached: ${targetId} executed ${steps} steps`);

      // 最終状態を返す
      const resultState = this.actionCache[stateHash][targetId][steps];
      return deepCopy(resultState);
    } catch (error) {
      debugLog(`Error in action animation:`, error);
      return previousState;
    } finally {
      this.isEvaluating = false;
      debugLog("Action evaluation completed, flag reset");
    }
  }

  // バウンズアニメーションの適用
  private async applyBoundsAnimation(
    boundsAnimation: NonNullable<UnifiedEvent["animation"]>["bounds"],
    previousState: DesmosState
  ): Promise<DesmosState> {
    if (!this.computeCalculator || !boundsAnimation) return previousState;
    this.computeCalculator.setState(previousState);

    try {
      // 現在のMath Boundsを取得（stateから取得）
      const currentBounds = {
        left: previousState.graph.viewport.xmin,
        right: previousState.graph.viewport.xmax,
        top: previousState.graph.viewport.ymax,
        bottom: previousState.graph.viewport.ymin,
      };

      let newBounds = { ...currentBounds };

      // 直接的なバウンズ指定の場合（補間は上位で処理済み）
      if (boundsAnimation.direct) {
        const { endBounds } = boundsAnimation.direct;
        newBounds = { ...endBounds };
        debugLog(`Applied direct bounds animation:`, newBounds);
      }
      // スケール・並進移動による計算の場合
      else {
        // 現在のビューの中心とサイズを計算
        const currentWidth = currentBounds.right - currentBounds.left;
        const currentHeight = currentBounds.top - currentBounds.bottom;
        let centerX = (currentBounds.left + currentBounds.right) / 2;
        let centerY = (currentBounds.top + currentBounds.bottom) / 2;

        // スケールアニメーション（補間は上位で処理済み）
        if (boundsAnimation.scale) {
          const scale = boundsAnimation.scale.endValue;
          const scaleCenter = {
            x: boundsAnimation.scale.centerX ?? centerX,
            y: boundsAnimation.scale.centerY ?? centerY,
          };

          // スケールの中心を基準にして新しいバウンズを計算
          const newWidth = currentWidth / scale;
          const newHeight = currentHeight / scale;

          newBounds = {
            left: scaleCenter.x - newWidth / 2,
            right: scaleCenter.x + newWidth / 2,
            top: scaleCenter.y + newHeight / 2,
            bottom: scaleCenter.y - newHeight / 2,
          };

          // centerを更新（並進移動で使用）
          centerX = scaleCenter.x;
          centerY = scaleCenter.y;

          debugLog(`Applied scale animation: scale=${scale}, center=(${centerX}, ${centerY})`);
        }

        // 並進移動（補間は上位で処理済み）
        if (boundsAnimation.translation) {
          const translation = boundsAnimation.translation;
          let offsetX = 0;
          let offsetY = 0;

          if (translation.mode === "displacement") {
            // 変位モード: 終了変位を使用
            offsetX = translation.endX;
            offsetY = translation.endY;
          } else if (translation.mode === "absolute") {
            // 絶対座標モード: 現在の中心から目標位置への変位
            offsetX = translation.endX - centerX;
            offsetY = translation.endY - centerY;
          }

          newBounds = {
            left: newBounds.left + offsetX,
            right: newBounds.right + offsetX,
            top: newBounds.top + offsetY,
            bottom: newBounds.bottom + offsetY,
          };

          debugLog(
            `Applied translation animation: offset=(${offsetX}, ${offsetY}), mode=${translation.mode}`
          );
        }
      }

      // 新しいバウンズを適用
      this.computeCalculator.setMathBounds(newBounds);
      debugLog(
        `Applied bounds animation result:`,
        this.computeCalculator.getState().graph.viewport
      );
    } catch (error) {
      debugLog(`Error applying bounds animation:`, error);
    }
    return this.computeCalculator.getState();
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

    // actionキャッシュもクリア
    this.actionCache = {};

    // 評価中フラグをリセット
    this.isEvaluating = false;

    // スクリーンショット中フラグをリセット
    this.isScreenshotting = false;

    // evaluation calculatorも初期状態にリセット
    if (this.evaluationCalculator) {
      try {
        this.evaluationCalculator.setState(getBlankDesmosState());
      } catch (error) {
        debugLog("Warning: Failed to reset evaluation calculator:", error);
      }
    }

    // screenshot calculatorも初期状態にリセット
    if (this.screenshotCalculator) {
      try {
        this.screenshotCalculator.setState(getBlankDesmosState());
      } catch (error) {
        debugLog("Warning: Failed to reset screenshot calculator:", error);
      }
    }

    debugLog("Cache cleared, action cache cleared, evaluation and screenshot state reset");
  }

  // 個別フレームのキャッシュを削除
  clearCacheAtFrame(frame: number): boolean {
    const existed = this.stateCache.has(frame);
    if (existed) {
      this.stateCache.delete(frame);
      debugLog(`Cache cleared for frame ${frame}`);
    }
    return existed;
  }

  // 範囲指定でキャッシュを削除
  clearCacheInRange(startFrame: number, endFrame: number): number {
    let deletedCount = 0;
    for (const frame of this.stateCache.keys()) {
      if (frame >= startFrame && frame <= endFrame) {
        this.stateCache.delete(frame);
        deletedCount++;
      }
    }
    debugLog(`Cache cleared for ${deletedCount} frames in range ${startFrame}-${endFrame}`);
    return deletedCount;
  }

  // 指定されたフレーム配列のキャッシュを削除
  clearCacheForFrames(frames: number[]): number {
    let deletedCount = 0;
    for (const frame of frames) {
      if (this.stateCache.has(frame)) {
        this.stateCache.delete(frame);
        deletedCount++;
      }
    }
    debugLog(`Cache cleared for ${deletedCount} specified frames`);
    return deletedCount;
  } // 初期状態更新機能は廃止

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
    const actionCacheStats = Object.keys(this.actionCache).reduce(
      (stats, hash) => {
        const expressions = Object.keys(this.actionCache[hash]);
        stats.totalHashes++;
        stats.totalExpressions += expressions.length;
        expressions.forEach((expr) => {
          stats.totalCachedSteps += this.actionCache[hash][expr].length;
        });
        return stats;
      },
      { totalHashes: 0, totalExpressions: 0, totalCachedSteps: 0 }
    );

    return {
      timelineEvents: this.timeline.length,
      stateEvents: this.stateEvents.length,
      cachedStates: this.stateCache.size,
      cachedTimes: Array.from(this.stateCache.keys()).sort((a, b) => a - b),
      cachedScreenshots: Array.from(this.stateCache.values()).filter((v) => v.screenshot).length,
      computeCalculatorSet: !!this.computeCalculator,
      evaluationCalculatorSet: !!this.evaluationCalculator,
      screenshotCalculatorSet: !!this.screenshotCalculator,
      isEvaluating: this.isEvaluating,
      isScreenshotting: this.isScreenshotting,
      actionCache: actionCacheStats,
    };
  }
  // 指定時刻のスクリーンショットを取得
  async getScreenshotAtFrame(frame: number): Promise<string | undefined> {
    return await this.stateCache.get(frame)?.screenshot;
  }

  // 全フレームのキャッシュを作成（stateとscreenshot両方）
  async createAllFrameCache(
    onProgress?: (currentFrame: number, totalFrames: number) => void
  ): Promise<void> {
    const totalFrames = this._videoSettings.durationFrames;
    debugLog(`Creating cache for all ${totalFrames} frames`);

    // 既存キャッシュをクリア
    this.clearCache();

    // 各フレームのstateとscreenshotを順次作成
    for (let frame = 0; frame < totalFrames; frame++) {
      try {
        // プログレス通知
        if (onProgress) {
          onProgress(frame, totalFrames);
        }

        // stateとscreenshotを取得（内部でキャッシュされる）
        debugLog(`Caching frame ${frame}/${totalFrames}`);
        await this.getStateAtFrame(frame, true); // screenshot=trueでスクリーンショットも取得

        // スクリーンショットのPromiseが解決されるまで待機
        const cache = this.stateCache.get(frame);
        if (cache?.screenshot) {
          await cache.screenshot;
          debugLog(`Screenshot cached for frame ${frame}`);
        }
      } catch (error) {
        console.error(`Failed to cache frame ${frame}:`, error);
        // エラーが発生しても続行
      }
    }

    debugLog("All frame cache creation completed");

    // 最終プログレス通知
    if (onProgress) {
      onProgress(totalFrames, totalFrames);
    }
  }
}

// StateManagerのシングルトンインスタンス
let stateManagerInstance: StateManager | null = null;

export function createStateManager(
  timeline: UnifiedEvent[] = [],
  stateEvents: StateEvent[] = []
): StateManager {
  stateManagerInstance = new StateManager(timeline, stateEvents);
  return stateManagerInstance;
}

export function getStateManager(): StateManager | null {
  return stateManagerInstance;
}
