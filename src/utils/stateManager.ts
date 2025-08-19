import type { Calculator, DesmosState } from "../types/desmos";
import type {
  DesmosExpression,
  TimelineEvent,
  StateEvent,
  ContinuousEvent,
} from "../types/timeline";

// デバッグモードのフラグ
const DEBUG_MODE = false;

// デバッグ用のログ関数
const debugLog = (...args: unknown[]) => {
  if (DEBUG_MODE) {
    console.log(...args);
  }
};

export class StateManager {
  private initialState: DesmosState;
  private timeline: TimelineEvent[];
  private stateEvents: StateEvent[];
  private continuousEvents: ContinuousEvent[];

  // 計算済み領域の管理
  private calculatedRegions: Array<{ start: number; end: number; startState: DesmosState }>;
  private eventStateCache: Map<number, DesmosState>; // イベント直後の状態のみキャッシュ

  constructor(
    initialState: DesmosState,
    timeline: TimelineEvent[],
    stateEvents: StateEvent[] = [],
    continuousEvents: ContinuousEvent[] = []
  ) {
    this.initialState = initialState;
    this.timeline = [...timeline].sort((a, b) => a.time - b.time);
    this.stateEvents = [...stateEvents].sort((a, b) => a.time - b.time);
    this.continuousEvents = continuousEvents;

    // 初期状態から計算済み領域を作成
    this.calculatedRegions = [];
    this.eventStateCache = new Map();
    this.initializeCalculatedRegions();
  }

  // 計算済み領域を初期化
  private initializeCalculatedRegions(): void {
    this.calculatedRegions = [];
    this.eventStateCache.clear();

    // 全ての挿入されたstate（初期状態 + StateEvents）を取得
    const insertedStates = [
      { time: 0, state: this.initialState, type: "initial" as const },
      ...this.stateEvents.map((se) => ({ time: se.time, state: se.state, type: "state" as const })),
    ].sort((a, b) => a.time - b.time);

    // 各挿入されたstateから計算可能な領域を決定
    for (let i = 0; i < insertedStates.length; i++) {
      const insertedState = insertedStates[i];
      const nextInsertedState = insertedStates[i + 1];

      const regionStart = insertedState.time;
      const regionEnd = nextInsertedState ? nextInsertedState.time : Infinity;

      // この領域内のイベントを取得（StateEvent時刻のイベントも含める）
      const eventsInRegion = this.timeline.filter(
        (event) => event.time >= regionStart && event.time < regionEnd
      );

      if (eventsInRegion.length === 0) {
        // イベントがない場合、次の挿入状態まで同じ状態が続く
        this.calculatedRegions.push({
          start: regionStart,
          end: regionEnd,
          startState: this.createSnapshotFromDesmosState(insertedState.state),
        });
      } else {
        // イベントがある場合の処理を改善
        let currentTime = regionStart;
        let currentState = this.createSnapshotFromDesmosState(insertedState.state);

        for (const event of eventsInRegion) {
          // イベント前までの領域を作成（初期状態からイベントまで）
          if (event.time > currentTime) {
            this.calculatedRegions.push({
              start: currentTime,
              end: event.time,
              startState: this.createSnapshotFromDesmosState(currentState),
            });
          }

          // イベントを適用した新しい状態を作成（deep copyで独立した状態を作成）
          const postEventState = this.createSnapshotFromDesmosState(currentState);
          this.applyEventToSnapshot(postEventState, event);

          // イベント直後の状態をキャッシュ
          this.eventStateCache.set(event.time, this.createSnapshotFromDesmosState(postEventState));

          // 次のイベントのために現在の状態を更新
          currentState = postEventState;
          currentTime = event.time;
        }

        // 最後のイベント後から領域終了まで
        if (currentTime < regionEnd) {
          this.calculatedRegions.push({
            start: currentTime,
            end: regionEnd,
            startState: this.createSnapshotFromDesmosState(currentState),
          });
        }
      }
    }

    debugLog(
      "Initialized calculated regions:",
      this.calculatedRegions.map((r) => ({
        start: r.start,
        end: r.end,
        startStateExpressions: r.startState.expressions.list.length,
      }))
    );
  }

  // 指定時刻が計算済み領域内かチェック
  isTimeCalculated(time: number): boolean {
    return this.calculatedRegions.some(
      (region) => time >= region.start && (time <= region.end || region.end === Infinity)
    );
  }

  // 指定時刻の状態を取得（計算済み領域内のみ）
  getStateAtTime(time: number): DesmosState {
    // 計算済み領域を検索
    const region = this.calculatedRegions.find(
      (region) => time >= region.start && (time <= region.end || region.end === Infinity)
    );

    if (!region) {
      throw new Error(
        `Time ${time}s is not in any calculated region. ` +
          `Calculated regions: ${this.calculatedRegions
            .map((r) => `${r.start}-${r.end}`)
            .join(", ")}`
      );
    }

    // 領域内にイベントがあるかチェック
    const eventsInRegion = this.timeline.filter(
      (event) => event.time > region.start && event.time <= time
    );

    if (eventsInRegion.length === 0) {
      // イベントがない場合、領域の開始状態をそのまま返す
      return this.createSnapshotFromDesmosState(region.startState);
    }

    // イベントがある場合、最後のイベント直後の状態から計算
    const lastEvent = eventsInRegion[eventsInRegion.length - 1];
    const eventState = this.eventStateCache.get(lastEvent.time);

    if (eventState) {
      // キャッシュされたイベント後状態を使用
      return this.createSnapshotFromDesmosState(eventState);
    }

    // キャッシュがない場合は領域開始状態から計算
    const currentState = this.createSnapshotFromDesmosState(region.startState);

    for (const event of eventsInRegion) {
      this.applyEventToSnapshot(currentState, event);
      // イベント直後の状態をキャッシュ
      this.eventStateCache.set(event.time, this.createSnapshotFromDesmosState(currentState));
    }

    return this.createSnapshotFromDesmosState(currentState);
  }

  // 指定時刻から計算を進める（イベント実行により計算済み領域を拡張）
  calculateFromTime(fromTime: number, toTime: number): void {
    debugLog(`Calculating from ${fromTime}s to ${toTime}s`);

    // fromTimeが計算済み領域内でない場合、最新の計算済み時刻から開始
    let actualFromTime = fromTime;
    if (!this.isTimeCalculated(fromTime)) {
      const maxCalculatedTime = this.getMaxCalculatedTime();
      if (maxCalculatedTime >= 0) {
        actualFromTime = maxCalculatedTime;
        debugLog(`Adjusted start time from ${fromTime}s to ${actualFromTime}s (max calculated)`);
      } else {
        throw new Error(`Cannot calculate from ${fromTime}s - no calculated regions available`);
      }
    }

    // actualFromTimeからtoTimeまでのイベントを取得
    const eventsToProcess = this.timeline.filter(
      (event) => event.time > actualFromTime && event.time <= toTime
    );

    debugLog(
      `Processing ${eventsToProcess.length} events between ${actualFromTime}s and ${toTime}s`
    );

    if (eventsToProcess.length === 0) {
      // イベントがない場合、該当する領域を拡張
      const region = this.calculatedRegions.find(
        (r) => actualFromTime >= r.start && actualFromTime <= r.end // <= に変更して境界を含める
      );
      if (region) {
        // イベント境界を超えて拡張しないように制限
        const nextEventTime = this.timeline.find((event) => event.time > actualFromTime)?.time;
        const maxExtendTime = nextEventTime ? Math.min(nextEventTime, toTime) : toTime;

        debugLog(
          `Extending region from ${region.end}s to ${maxExtendTime}s (limited by next event at ${nextEventTime}s)`
        );
        region.end = Math.max(region.end, maxExtendTime);
        debugLog(`Region extended to: ${region.start}s-${region.end}s`);
      } else {
        // 既存の領域が見つからない場合、新しい領域を作成
        // actualFromTimeの状態を取得して新しい領域の開始状態とする
        try {
          const startState = this.getStateAtTime(actualFromTime);

          // 次のイベントまでの制限を適用
          const nextEventTime = this.timeline.find((event) => event.time > actualFromTime)?.time;
          const maxEndTime = nextEventTime ? Math.min(nextEventTime, toTime) : toTime;

          this.calculatedRegions.push({
            start: actualFromTime,
            end: maxEndTime,
            startState: startState,
          });
          debugLog(
            `Created new region: ${actualFromTime}s-${maxEndTime}s (limited by next event at ${nextEventTime}s)`
          );
        } catch (error) {
          console.warn(`Failed to create new region from ${actualFromTime}s:`, error);
        }
      }
      return;
    }

    // 各イベントを順番に処理
    let currentState = this.getStateAtTime(actualFromTime);

    for (const event of eventsToProcess) {
      debugLog(`Processing event at ${event.time}s: ${event.action}`);

      // 前の状態をベースにイベントを適用（完全なdeep copy）
      const postEventState = this.createSnapshotFromDesmosState(currentState);
      this.applyEventToSnapshot(postEventState, event);

      // イベント直後の状態をキャッシュ
      this.eventStateCache.set(event.time, this.createSnapshotFromDesmosState(postEventState));

      // 新しい計算済み領域を作成（イベント直後から次のイベントまたは終了時刻まで）
      const nextEvent = eventsToProcess.find((e) => e.time > event.time);
      const regionEnd = nextEvent ? nextEvent.time : toTime;

      // 既存の領域と重複しないように追加
      const existingRegion = this.calculatedRegions.find((r) => r.start === event.time);
      if (!existingRegion) {
        this.calculatedRegions.push({
          start: event.time,
          end: regionEnd,
          startState: this.createSnapshotFromDesmosState(postEventState),
        });
        debugLog(`Created new calculated region: ${event.time}s to ${regionEnd}s`);
      } else {
        // 既存の領域を拡張
        existingRegion.end = Math.max(existingRegion.end, regionEnd);
        debugLog(`Extended existing region to: ${existingRegion.end}s`);
      }

      // 次のイベントのために現在の状態を更新
      currentState = postEventState;
    }

    // 領域をマージ・最適化
    this.optimizeCalculatedRegions();

    debugLog(`Calculation completed. Total regions:`, this.calculatedRegions.length);
  }

  // 計算済み領域を最適化（重複や隣接する領域をマージ）
  private optimizeCalculatedRegions(): void {
    if (this.calculatedRegions.length <= 1) return;

    // 時刻順にソート
    this.calculatedRegions.sort((a, b) => a.start - b.start);

    // イベント時刻のセットを作成（境界として保護すべき時刻）
    const eventTimes = new Set(this.timeline.map((event) => event.time));
    eventTimes.add(0); // 初期時刻も保護

    // 重複や隣接する領域をマージ（ただしイベント境界は跨がない）
    const optimized: Array<{ start: number; end: number; startState: DesmosState }> = [];

    for (const region of this.calculatedRegions) {
      if (optimized.length === 0) {
        optimized.push({ ...region });
        continue;
      }

      const lastRegion = optimized[optimized.length - 1];

      // イベント境界を跨がないかチェック
      const hasEventBetween = Array.from(eventTimes).some(
        (eventTime) => eventTime > lastRegion.end && eventTime < region.start
      );

      // 重複または隣接している場合（小さな隙間も許容）かつイベント境界を跨がない
      if (region.start <= lastRegion.end + 0.001 && !hasEventBetween) {
        // マージ：より大きな終了時刻を採用
        lastRegion.end = Math.max(lastRegion.end, region.end);
        debugLog(
          `Merged regions: ${lastRegion.start}-${lastRegion.end} (no event boundary crossed)`
        );
      } else {
        optimized.push({ ...region });
        if (hasEventBetween) {
          debugLog(
            `Kept separate regions due to event boundary: ${lastRegion.start}-${lastRegion.end} and ${region.start}-${region.end}`
          );
        }
      }
    }

    this.calculatedRegions = optimized;
    debugLog(`Optimized to ${this.calculatedRegions.length} regions`);
  }

  // StateEventを追加
  addStateEvent(stateEvent: StateEvent): void {
    this.stateEvents.push(stateEvent);
    this.stateEvents.sort((a, b) => a.time - b.time);

    // 計算済み領域を再初期化
    this.initializeCalculatedRegions();
  }

  // StateEventを削除
  removeStateEvent(eventId: string): void {
    this.stateEvents = this.stateEvents.filter((event) => event.id !== eventId);

    // 計算済み領域を再初期化
    this.initializeCalculatedRegions();
  }

  // TimelineEventを追加
  addTimelineEvent(event: Omit<TimelineEvent, "id">): TimelineEvent {
    const newEvent: TimelineEvent = {
      ...event,
      id: `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.timeline.push(newEvent);
    this.timeline.sort((a, b) => a.time - b.time);

    // 計算済み領域を再初期化
    this.initializeCalculatedRegions();

    return newEvent;
  }

  // TimelineEventを編集
  updateTimelineEvent(eventId: string, updates: Partial<Omit<TimelineEvent, "id">>): boolean {
    const eventIndex = this.timeline.findIndex((event) => event.id === eventId);
    if (eventIndex === -1) {
      return false;
    }

    // イベントを更新
    this.timeline[eventIndex] = {
      ...this.timeline[eventIndex],
      ...updates,
    };

    // 時刻が変更された場合はソート
    if (updates.time !== undefined) {
      this.timeline.sort((a, b) => a.time - b.time);
    }

    // 計算済み領域を再初期化
    this.initializeCalculatedRegions();

    return true;
  }

  // TimelineEventを削除
  removeTimelineEvent(eventId: string): boolean {
    const initialLength = this.timeline.length;
    this.timeline = this.timeline.filter((event) => event.id !== eventId);

    if (this.timeline.length < initialLength) {
      // 計算済み領域を再初期化
      this.initializeCalculatedRegions();
      return true;
    }

    return false;
  }

  // TimelineEventを取得
  getTimelineEvent(eventId: string): TimelineEvent | null {
    return this.timeline.find((event) => event.id === eventId) || null;
  }

  // 全TimelineEventを取得
  getTimelineEvents(): TimelineEvent[] {
    return [...this.timeline];
  }

  // 現在のcalculatorの状態から指定時刻にStateEventを作成
  createStateEventFromCalculator(
    time: number,
    calculator: Calculator,
    description?: string
  ): StateEvent {
    const currentState = this.captureCalculatorState(calculator);
    const stateEvent: StateEvent = {
      time,
      type: "state",
      state: currentState,
      id: `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: description || `State at ${time}s`,
    };

    this.addStateEvent(stateEvent);
    return stateEvent;
  }

  // チェックポイントを作成（deprecated - 新しいシステムでは不要）
  createCheckpoint(time: number, _calculator: Calculator): void {
    console.warn("createCheckpoint is deprecated in the new system");
    // 代わりに計算を実行
    if (this.isTimeCalculated(time)) {
      debugLog(`Time ${time}s is already calculated`);
    } else {
      debugLog(`Time ${time}s is not calculated yet`);
    }
  }

  // timeの状態を計算してcalculatorに適用
  applyStateAtTime(time: number, calculator: Calculator): void {
    debugLog(`StateManager: Applying state at time ${time}`);

    try {
      const state = this.getStateAtTime(time);
      this.applyStateToCalculator(state, calculator);

      debugLog(`StateManager: Applied state with ${state.expressions.list.length} expressions`);

      // デバッグ用：適用された式の内容をログ出力
      state.expressions.list.forEach((expr: DesmosExpression) => {
        debugLog(`  Expression ${expr.id}: ${expr.latex} (hidden: ${expr.hidden})`);
      });
    } catch (error) {
      console.error(`Failed to apply state at ${time}s:`, error);
    }
  }

  // キャッシュをクリア（新システムでは計算済み領域をクリア）
  clearCache(): void {
    this.eventStateCache.clear();
    this.initializeCalculatedRegions();
    debugLog("Calculated regions reset to initial state");
  }

  // timelineを更新
  updateTimeline(timeline: TimelineEvent[]): void {
    this.timeline = [...timeline].sort((a, b) => a.time - b.time);
    // タイムラインが変更されたので、計算済み領域を再初期化
    this.initializeCalculatedRegions();
  }

  // StateEventsを更新
  updateStateEvents(stateEvents: StateEvent[]): void {
    this.stateEvents = [...stateEvents].sort((a, b) => a.time - b.time);
    // StateEventsが変更されたので、計算済み領域を再初期化
    this.initializeCalculatedRegions();
  }

  // 連続イベントを更新
  updateContinuousEvents(continuousEvents: ContinuousEvent[]): void {
    this.continuousEvents = continuousEvents;
    // 連続イベントが変更されたので、計算済み領域を再初期化
    this.initializeCalculatedRegions();
  }

  // 初期stateを更新
  updateInitialState(initialState: DesmosState): void {
    this.initialState = initialState;
    // 初期状態が変更されたので、計算済み領域を再初期化
    this.initializeCalculatedRegions();
  }

  // stateをcalculatorに適用
  applyStateToCalculator(state: DesmosState, calculator: Calculator): void {
    try {
      // 現在の式のIDリストを取得
      const currentExpressions = calculator.getExpressions();
      const currentIds = new Set(currentExpressions.map((expr) => expr.id));

      // 目標stateで必要な式のIDリスト
      const targetIds = new Set(state.expressions.list.map((expr) => expr.id));

      // 不要な式を削除
      currentIds.forEach((id) => {
        if (!targetIds.has(id)) {
          try {
            calculator.removeExpression({ id });
          } catch (error) {
            console.warn(`Failed to remove expression ${id}:`, error);
          }
        }
      });

      // mathBoundsを設定
      if (state.graph?.viewport) {
        try {
          const viewport = state.graph.viewport;
          calculator.setMathBounds({
            left: viewport.xmin,
            right: viewport.xmax,
            bottom: viewport.ymin,
            top: viewport.ymax,
          });
        } catch (error) {
          console.warn("Failed to set math bounds:", error);
        }
      }

      // 式を設定/更新
      state.expressions.list.forEach((expr) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const expressionData: any = {
            id: expr.id,
            latex: expr.latex,
          };

          // 全てのプロパティを動的に追加（undefined以外）
          Object.entries(expr).forEach(([key, value]) => {
            if (key !== "id" && key !== "latex" && value !== undefined) {
              expressionData[key] = value;
            }
          });

          calculator.setExpression(expressionData);
        } catch (error) {
          console.warn(`Failed to set expression ${expr.id}:`, error);
        }
      });

      // DesmosStateには変数や設定は含まれていません
    } catch (error) {
      console.error("Error applying state to calculator:", error);
    }
  }

  // StateEventsのゲッター
  getStateEvents(): StateEvent[] {
    return [...this.stateEvents];
  }

  // 計算済み領域のゲッター
  getCalculatedRegions(): Array<{ start: number; end: number }> {
    return this.calculatedRegions.map((region) => ({
      start: region.start,
      end: region.end,
    }));
  }

  // 重要な時刻のゲッター（計算済み領域内の重要な時刻）
  getCriticalTimes(): number[] {
    const times = new Set<number>();

    // 計算済み領域内の時刻のみを対象とする
    for (const region of this.calculatedRegions) {
      // 初期時刻
      times.add(0);

      // TimelineEventの時刻
      this.timeline.forEach((event) => {
        if (event.time >= region.start && event.time < region.end) {
          times.add(event.time);
        }
      });

      // StateEventの時刻
      this.stateEvents.forEach((event) => {
        if (event.time >= region.start && event.time < region.end) {
          times.add(event.time);
        }
      });

      // ContinuousEventの開始・終了時刻
      this.continuousEvents.forEach((event) => {
        if (event.startTime >= region.start && event.startTime < region.end) {
          times.add(event.startTime);
        }
        const endTime = event.startTime + event.duration;
        if (endTime >= region.start && endTime < region.end) {
          times.add(endTime);
        }
      });
    }

    return Array.from(times).sort((a, b) => a - b);
  }

  // 計算済みの最大時刻を取得
  getMaxCalculatedTime(): number {
    if (this.calculatedRegions.length === 0) {
      return 0;
    }

    // 無限大の領域がある場合は、それ以外の最大時刻を返す
    const finiteEnds = this.calculatedRegions
      .map((region) => region.end)
      .filter((end) => end !== Infinity);

    if (finiteEnds.length === 0) {
      // 全て無限大の場合は、最大の開始時刻を返す
      return Math.max(...this.calculatedRegions.map((region) => region.start));
    }

    return Math.max(...finiteEnds);
  }

  // デバッグ用：キャッシュ情報を取得（新システム用）
  getCacheInfo() {
    return {
      calculatedRegions: this.calculatedRegions.length,
      eventCacheSize: this.eventStateCache.size,
      calculatedRegionDetails: this.calculatedRegions.map(
        (region) =>
          `${region.start.toFixed(1)}-${region.end === Infinity ? "∞" : region.end.toFixed(1)}`
      ),
    };
  }

  // calculatorの現在stateをキャプチャ
  private captureCalculatorState(calculator: Calculator): DesmosState {
    try {
      // 実際のgetState()を使用
      return calculator.getState();
    } catch (error) {
      debugLog("Error capturing calculator state, using fallback:", error);

      // フォールバック実装
      const expressions = calculator.getExpressions().map((expr) => ({
        id: expr.id,
        latex: expr.latex,
        hidden: expr.hidden || false,
        color: expr.color || "#000000",
        lineStyle: expr.lineStyle,
        lineWidth: expr.lineWidth,
      }));

      // graphpaperBounds.mathCoordinatesを使用
      const mathCoords = calculator.graphpaperBounds?.mathCoordinates || {
        left: -10,
        right: 10,
        top: 10,
        bottom: -10,
      };

      return {
        version: 11,
        randomSeed: Math.random().toString(36),
        graph: {
          viewport: {
            xmin: mathCoords.left,
            ymin: mathCoords.bottom,
            xmax: mathCoords.right,
            ymax: mathCoords.top,
          },
          showGrid: true,
          showXAxis: true,
          showYAxis: true,
        },
        expressions: {
          list: expressions as DesmosExpression[],
        },
      };
    }
  }

  // DesmosStateからSnapshotを作成（完全なdeep copy）
  private createSnapshotFromDesmosState(state: DesmosState): DesmosState {
    const result: DesmosState = {
      ...state,
      expressions: {
        ...state.expressions,
        list: state.expressions.list.map((expr: DesmosExpression) => ({
          ...expr,
          // 深いコピーのため、式のプロパティもコピー
          type: expr.type,
          id: expr.id,
          latex: expr.latex,
          hidden: expr.hidden,
          color: expr.color,
          lineStyle: expr.lineStyle,
          lineWidth: expr.lineWidth,
        })),
      },
    };

    // graphプロパティを個別に処理
    if (state.graph) {
      result.graph = {
        ...state.graph,
        viewport: state.graph.viewport
          ? { ...state.graph.viewport }
          : {
              xmin: -10,
              ymin: -10,
              xmax: 10,
              ymax: 10,
            },
      };
    }

    return result;
  }

  // Snapshotにイベントを適用（単一イベント用）
  private applyEventToSnapshot(snapshot: DesmosState, event: TimelineEvent): void {
    switch (event.action) {
      case "setExpression": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newExpr: any = {
          id: event.args.id as string,
          latex: event.args.latex as string,
          hidden: (event.args.hidden as boolean) || false,
          color: (event.args.color as string) || "#000000",
          lineStyle: event.args.lineStyle,
          lineWidth: event.args.lineWidth,
        };

        // 既存の式を更新または追加
        const existingIndex = snapshot.expressions.list.findIndex((expr) => expr.id === newExpr.id);
        if (existingIndex !== -1) {
          snapshot.expressions.list[existingIndex] = newExpr;
        } else {
          snapshot.expressions.list.push(newExpr);
        }
        break;
      }

      case "startAnimation": {
        // アニメーション開始 - 変数の初期値を設定
        // 注意: DesmosStateには直接変数プロパティがないため、
        // 実際の実装では式として処理する必要があります
        const { variable, startValue } = event.args;
        console.log(`Start animation: ${variable} = ${startValue}`);
        break;
      }

      case "endAnimation": {
        // アニメーション終了 - 変数の最終値を設定
        const { variable, value } = event.args;
        console.log(`End animation: ${variable} = ${value}`);
        break;
      }

      case "setMathBounds":
        // ビューポートを設定
        if (snapshot.graph) {
          snapshot.graph.viewport = {
            xmin: event.args.left as number,
            ymin: event.args.bottom as number,
            xmax: event.args.right as number,
            ymax: event.args.top as number,
          };
        }
        break;

      default:
        console.warn(`Unknown action: ${event.action}`);
    }
  }

  // 変数アニメーションの補間処理は新システムでは不要

  // デバッグ情報のゲッター
  getDebugInfo() {
    return {
      calculatedRegions: this.calculatedRegions.map((r) => ({
        start: r.start,
        end: r.end,
        startStateExpressions: r.startState.expressions.list.length,
      })),
      eventCache: Array.from(this.eventStateCache.keys()).sort((a, b) => a - b),
      timelineEvents: this.timeline.map((e) => ({
        time: e.time,
        action: e.action,
        id: e.id,
      })),
      stateEvents: this.stateEvents.map((e) => ({
        time: e.time,
        id: e.id,
      })),
    };
  }

  // 特定の時刻での詳細デバッグ情報
  getDebugAtTime(time: number) {
    const region = this.calculatedRegions.find((r) => time >= r.start && time < r.end);
    const nearbyEvents = this.timeline.filter((e) => Math.abs(e.time - time) < 1);

    return {
      requestedTime: time,
      foundRegion: region
        ? {
            start: region.start,
            end: region.end,
          }
        : null,
      nearbyEvents: nearbyEvents.map((e) => ({
        time: e.time,
        action: e.action,
        distance: Math.abs(e.time - time),
      })),
      cachedStates: Array.from(this.eventStateCache.keys())
        .filter((t) => Math.abs(t - time) < 1)
        .sort((a, b) => a - b),
    };
  }
}
