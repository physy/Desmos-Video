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
  private initialState: DesmosState;
  private timeline: UnifiedEvent[];
  private stateEvents: StateEvent[];
  private continuousEvents: ContinuousEvent[];

  // 計算用calculator（非表示、state計算専用）
  private computeCalculator: Calculator | null = null;

  // 状態キャッシュ
  private stateCache: Map<number, DesmosState> = new Map();

  constructor(
    initialState: DesmosState,
    timeline: UnifiedEvent[] = [],
    stateEvents: StateEvent[] = [],
    continuousEvents: ContinuousEvent[] = []
  ) {
    this.initialState = deepCopy(initialState);
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

  // 指定時刻の状態を計算して取得
  async getStateAtTime(time: number): Promise<DesmosState> {
    if (!this.computeCalculator) {
      throw new Error("Compute calculator not set. Call setComputeCalculator() first.");
    }

    // キャッシュチェック
    if (this.stateCache.has(time)) {
      debugLog(`Cache hit for time ${time}`);
      return deepCopy(this.stateCache.get(time)!);
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

    // 4. キャッシュに保存
    this.stateCache.set(time, deepCopy(state));

    debugLog(`State computed and cached for time ${time}`);
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

    debugLog("Resetting compute calculator to initial state");
    // 初期状態を適用
    this.applyStateToCalculator(this.initialState, this.computeCalculator);
  }

  // 指定時刻までのイベントを取得
  private getEventsUpToTime(time: number): Array<UnifiedEvent | StateEvent> {
    const events: Array<UnifiedEvent | StateEvent> = [];

    // StateEventsを追加（指定時刻以前）
    for (const stateEvent of this.stateEvents) {
      if (stateEvent.time <= time) {
        events.push(stateEvent);
      }
    }

    // UnifiedEventsを追加（指定時刻以前）
    for (const event of this.timeline) {
      if (event.time <= time) {
        events.push(event);
      }
    }

    // 時系列順にソート
    return events.sort((a, b) => a.time - b.time);
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

  // Animation イベントを適用
  private async applyAnimationEvent(event: UnifiedEvent): Promise<void> {
    if (!this.computeCalculator || event.type !== "animation" || !event.animation) return;

    const { variable, endValue } = event.animation;

    // アニメーションの終了値を変数として設定
    try {
      this.computeCalculator.setExpression({
        id: `__animation_${variable}`,
        latex: `${variable} = ${endValue}`,
      });
      debugLog(`Applied animation: ${variable} = ${endValue}`);
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

  // 初期状態を更新
  updateInitialState(initialState: DesmosState): void {
    this.initialState = deepCopy(initialState);
    this.clearCache();
    debugLog("Initial state updated");
  }

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
      computeCalculatorSet: !!this.computeCalculator,
    };
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
  initialState: DesmosState,
  timeline: UnifiedEvent[] = [],
  stateEvents: StateEvent[] = [],
  continuousEvents: ContinuousEvent[] = []
): StateManager {
  stateManagerInstance = new StateManager(initialState, timeline, stateEvents, continuousEvents);
  return stateManagerInstance;
}

export function getStateManager(): StateManager | null {
  return stateManagerInstance;
}
