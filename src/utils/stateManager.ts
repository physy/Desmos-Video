import type { Calculator } from "../types/desmos";
import type {
  DesmosState,
  DesmosExpression,
  StateSnapshot,
  TimelineEvent,
  StateEvent,
  ContinuousEvent,
} from "../types/timeline";

export class StateManager {
  private initialState: DesmosState;
  private timeline: TimelineEvent[];
  private stateEvents: StateEvent[];
  private continuousEvents: ContinuousEvent[];

  // 計算済み領域の管理
  private calculatedRegions: Array<{ start: number; end: number; startState: StateSnapshot }>;
  private eventStateCache: Map<number, StateSnapshot>; // イベント直後の状態のみキャッシュ

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
        (event) => event.time > regionStart && event.time < regionEnd
      );

      if (eventsInRegion.length === 0) {
        // イベントがない場合、次の挿入状態まで同じ状態が続く
        this.calculatedRegions.push({
          start: regionStart,
          end: regionEnd,
          startState: this.createSnapshotFromDesmosState(insertedState.state, regionStart),
        });
      } else {
        // イベントがある場合、最初のイベントまでは計算済み
        const firstEvent = eventsInRegion[0];
        this.calculatedRegions.push({
          start: regionStart,
          end: firstEvent.time,
          startState: this.createSnapshotFromDesmosState(insertedState.state, regionStart),
        });
      }
    }

    console.log("Initialized calculated regions:", this.calculatedRegions);
  }

  // 指定時刻が計算済み領域内かチェック
  isTimeCalculated(time: number): boolean {
    return this.calculatedRegions.some(
      (region) => time >= region.start && (time <= region.end || region.end === Infinity)
    );
  }

  // 指定時刻の状態を取得（計算済み領域内のみ）
  getStateAtTime(time: number): StateSnapshot {
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
      return {
        ...region.startState,
        time: time,
      };
    }

    // イベントがある場合、最後のイベント直後の状態から計算
    const lastEvent = eventsInRegion[eventsInRegion.length - 1];
    const eventState = this.eventStateCache.get(lastEvent.time);

    if (eventState) {
      // キャッシュされたイベント後状態を使用
      return {
        ...eventState,
        time: time,
      };
    }

    // キャッシュがない場合は領域開始状態から計算
    const currentState = { ...region.startState };

    for (const event of eventsInRegion) {
      this.applyEventToSnapshot(currentState, event);
      // イベント直後の状態をキャッシュ
      this.eventStateCache.set(event.time, { ...currentState, time: event.time });
    }

    const finalState = {
      ...currentState,
      time: time,
    };

    // 変数アニメーションの補間処理
    this.applyVariableAnimations(finalState, time);

    return finalState;
  }

  // 指定時刻から計算を進める（イベント実行により計算済み領域を拡張）
  calculateFromTime(fromTime: number, toTime: number): void {
    console.log(`Calculating from ${fromTime}s to ${toTime}s`);

    // fromTimeが計算済み領域内でない場合、最新の計算済み時刻から開始
    let actualFromTime = fromTime;
    if (!this.isTimeCalculated(fromTime)) {
      const maxCalculatedTime = this.getMaxCalculatedTime();
      if (maxCalculatedTime >= 0) {
        actualFromTime = maxCalculatedTime;
        console.log(`Adjusted start time from ${fromTime}s to ${actualFromTime}s (max calculated)`);
      } else {
        throw new Error(`Cannot calculate from ${fromTime}s - no calculated regions available`);
      }
    }

    // actualFromTimeからtoTimeまでのイベントを取得
    const eventsToProcess = this.timeline.filter(
      (event) => event.time > actualFromTime && event.time <= toTime
    );

    console.log(
      `Processing ${eventsToProcess.length} events between ${actualFromTime}s and ${toTime}s`
    );

    if (eventsToProcess.length === 0) {
      // イベントがない場合、該当する領域を拡張
      const region = this.calculatedRegions.find(
        (r) => actualFromTime >= r.start && actualFromTime <= r.end // <= に変更して境界を含める
      );
      if (region) {
        console.log(`Extending region from ${region.end}s to ${toTime}s`);
        region.end = Math.max(region.end, toTime);
        console.log(`Region extended to: ${region.start}s-${region.end}s`);
      } else {
        // 既存の領域が見つからない場合、新しい領域を作成
        // actualFromTimeの状態を取得して新しい領域の開始状態とする
        try {
          const startState = this.getStateAtTime(actualFromTime);
          this.calculatedRegions.push({
            start: actualFromTime,
            end: toTime,
            startState: startState,
          });
          console.log(`Created new region: ${actualFromTime}s-${toTime}s`);
        } catch (error) {
          console.warn(`Failed to create new region from ${actualFromTime}s:`, error);
        }
      }
      return;
    }

    // 各イベントを順番に処理
    let currentState = this.getStateAtTime(actualFromTime);

    for (const event of eventsToProcess) {
      console.log(`Processing event at ${event.time}s: ${event.action}`);

      // 前の状態をベースにイベントを適用（deep copy）
      const postEventState: StateSnapshot = {
        ...currentState,
        expressions: currentState.expressions.map((expr) => ({ ...expr })),
        mathBounds: { ...currentState.mathBounds },
        settings: { ...currentState.settings },
        variables: { ...currentState.variables },
      };
      this.applyEventToSnapshot(postEventState, event);
      postEventState.time = event.time;

      // イベント直後の状態をキャッシュ
      this.eventStateCache.set(event.time, { ...postEventState });

      // 新しい計算済み領域を作成（イベント直後から次のイベントまたは終了時刻まで）
      const nextEvent = eventsToProcess.find((e) => e.time > event.time);
      const regionEnd = nextEvent ? nextEvent.time : toTime;

      // 既存の領域と重複しないように追加
      const existingRegion = this.calculatedRegions.find((r) => r.start === event.time);
      if (!existingRegion) {
        this.calculatedRegions.push({
          start: event.time,
          end: regionEnd,
          startState: { ...postEventState },
        });
        console.log(`Created new calculated region: ${event.time}s to ${regionEnd}s`);
      } else {
        // 既存の領域を拡張
        existingRegion.end = Math.max(existingRegion.end, regionEnd);
        console.log(`Extended existing region to: ${existingRegion.end}s`);
      }

      // 次のイベントのために現在の状態を更新
      currentState = postEventState;
    }

    // 領域をマージ・最適化
    this.optimizeCalculatedRegions();

    console.log(`Calculation completed. Total regions:`, this.calculatedRegions.length);
  }

  // 計算済み領域を最適化（重複や隣接する領域をマージ）
  private optimizeCalculatedRegions(): void {
    if (this.calculatedRegions.length <= 1) return;

    // 時刻順にソート
    this.calculatedRegions.sort((a, b) => a.start - b.start);

    // 重複や隣接する領域をマージ
    const optimized: Array<{ start: number; end: number; startState: StateSnapshot }> = [];

    for (const region of this.calculatedRegions) {
      if (optimized.length === 0) {
        optimized.push({ ...region });
        continue;
      }

      const lastRegion = optimized[optimized.length - 1];

      // 重複または隣接している場合（小さな隙間も許容）
      if (region.start <= lastRegion.end + 0.001) {
        // マージ：より大きな終了時刻を採用
        lastRegion.end = Math.max(lastRegion.end, region.end);
        console.log(`Merged regions: ${lastRegion.start}-${lastRegion.end}`);
      } else {
        optimized.push({ ...region });
      }
    }

    this.calculatedRegions = optimized;
    console.log(`Optimized to ${this.calculatedRegions.length} regions`);
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
      console.log(`Time ${time}s is already calculated`);
    } else {
      console.log(`Time ${time}s is not calculated yet`);
    }
  }

  // timeの状態を計算してcalculatorに適用
  applyStateAtTime(time: number, calculator: Calculator): void {
    console.log(`StateManager: Applying state at time ${time}`);

    try {
      const state = this.getStateAtTime(time);
      this.applyStateToCalculator(state, calculator);

      console.log(`StateManager: Applied state with ${state.expressions.length} expressions`);

      // デバッグ用：適用された式の内容をログ出力
      state.expressions.forEach((expr: DesmosExpression) => {
        console.log(`  Expression ${expr.id}: ${expr.latex} (hidden: ${expr.hidden})`);
      });
    } catch (error) {
      console.error(`Failed to apply state at ${time}s:`, error);
    }
  }

  // キャッシュをクリア（新システムでは計算済み領域をクリア）
  clearCache(): void {
    this.eventStateCache.clear();
    this.initializeCalculatedRegions();
    console.log("Calculated regions reset to initial state");
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
  applyStateToCalculator(state: StateSnapshot, calculator: Calculator): void {
    try {
      // 現在の式のIDリストを取得
      const currentExpressions = calculator.getExpressions();
      const currentIds = new Set(currentExpressions.map((expr) => expr.id));

      // 目標stateで必要な式のIDリスト
      const targetIds = new Set(state.expressions.map((expr) => expr.id));

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
      if (state.mathBounds) {
        try {
          calculator.setMathBounds(state.mathBounds);
        } catch (error) {
          console.warn("Failed to set math bounds:", error);
        }
      }

      // 式を設定/更新
      state.expressions.forEach((expr) => {
        try {
          const expressionData: {
            id: string;
            latex: string;
            hidden?: boolean;
            color?: string;
            lineStyle?: string;
            lineWidth?: number;
          } = {
            id: expr.id,
            latex: expr.latex,
          };

          // オプションのプロパティを条件付きで追加
          if (expr.hidden !== undefined) {
            expressionData.hidden = expr.hidden;
          }
          if (expr.color) {
            expressionData.color = expr.color;
          }
          if (expr.lineStyle) {
            expressionData.lineStyle = expr.lineStyle;
          }
          if (expr.lineWidth !== undefined) {
            expressionData.lineWidth = expr.lineWidth;
          }

          calculator.setExpression(expressionData);
        } catch (error) {
          console.warn(`Failed to set expression ${expr.id}:`, error);
        }
      });

      // 変数を設定
      Object.entries(state.variables).forEach(([name, value]) => {
        try {
          calculator.setExpression({
            id: `var_${name}`,
            latex: `${name}=${value}`,
          });
        } catch (error) {
          console.warn(`Failed to set variable ${name}:`, error);
        }
      });

      // 設定を適用
      Object.entries(state.settings).forEach(([key, value]) => {
        try {
          if (calculator.updateSettings) {
            calculator.updateSettings({ [key]: value });
          }
        } catch (error) {
          console.warn(`Failed to update setting ${key}:`, error);
        }
      });
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
    const expressions = calculator.getExpressions().map((expr) => ({
      id: expr.id,
      latex: expr.latex,
      hidden: expr.hidden || false,
      color: expr.color || "#000000",
      lineStyle: expr.lineStyle,
      lineWidth: expr.lineWidth,
    }));

    // graphpaperBounds.mathCoordinatesを使用（getMathBoundsは存在しない）
    const mathBounds = calculator.graphpaperBounds?.mathCoordinates || {
      left: -10,
      right: 10,
      top: 10,
      bottom: -10,
    };

    return {
      expressions,
      mathBounds: {
        left: mathBounds.left,
        right: mathBounds.right,
        top: mathBounds.top,
        bottom: mathBounds.bottom,
      },
      settings: {},
    };
  }

  // DesmosStateからSnapshotを作成
  private createSnapshotFromDesmosState(state: DesmosState, time: number): StateSnapshot {
    return {
      time,
      expressions: state.expressions.map((expr) => ({ ...expr })), // deep copy
      mathBounds: { ...state.mathBounds },
      settings: { ...state.settings },
      variables: {},
    };
  }

  // Snapshotにイベントを適用（単一イベント用）
  private applyEventToSnapshot(snapshot: StateSnapshot, event: TimelineEvent): void {
    switch (event.action) {
      case "addExpression": {
        const newExpr = {
          id: event.args.id as string,
          latex: event.args.latex as string,
          hidden: (event.args.hidden as boolean) || false,
          color: (event.args.color as string) || "#000000",
          lineStyle: event.args.lineStyle as string,
          lineWidth: event.args.lineWidth as number,
        };

        // 既存の式を更新または追加
        const existingIndex = snapshot.expressions.findIndex((expr) => expr.id === newExpr.id);
        if (existingIndex >= 0) {
          snapshot.expressions[existingIndex] = newExpr;
        } else {
          snapshot.expressions.push(newExpr);
        }
        break;
      }

      case "removeExpression":
        snapshot.expressions = snapshot.expressions.filter(
          (expr) => expr.id !== (event.args.id as string)
        );
        break;

      case "setHidden": {
        const exprToHide = snapshot.expressions.find(
          (expr) => expr.id === (event.args.id as string)
        );
        if (exprToHide) {
          exprToHide.hidden = event.args.hidden as boolean;
        }
        break;
      }

      case "updateExpression": {
        const exprToUpdate = snapshot.expressions.find(
          (expr) => expr.id === (event.args.id as string)
        );
        if (exprToUpdate) {
          // プロパティを更新
          if (event.args.color) exprToUpdate.color = event.args.color as string;
          if (event.args.hidden !== undefined) exprToUpdate.hidden = event.args.hidden as boolean;
          if (event.args.latex) exprToUpdate.latex = event.args.latex as string;
          if (event.args.lineStyle) exprToUpdate.lineStyle = event.args.lineStyle as string;
          if (event.args.lineWidth) exprToUpdate.lineWidth = event.args.lineWidth as number;
        }
        break;
      }

      case "startAnimation": {
        // アニメーション開始 - 変数の初期値を設定
        const { variable, startValue } = event.args;
        snapshot.variables[variable as string] = startValue as number;
        break;
      }

      case "endAnimation": {
        // アニメーション終了 - 変数の最終値を設定
        const { variable, value } = event.args;
        snapshot.variables[variable as string] = value as number;
        break;
      }

      case "setMathBounds":
        snapshot.mathBounds = {
          left: event.args.left as number,
          right: event.args.right as number,
          top: event.args.top as number,
          bottom: event.args.bottom as number,
        };
        break;

      case "setBounds":
        // setBoundsのエイリアス
        snapshot.mathBounds = {
          left: event.args.left as number,
          right: event.args.right as number,
          top: event.args.top as number,
          bottom: event.args.bottom as number,
        };
        break;

      case "setVariable":
        snapshot.variables[event.args.name as string] = event.args.value as number;
        break;

      case "updateSettings":
        Object.assign(snapshot.settings, event.args);
        break;

      default:
        console.warn(`Unknown action: ${event.action}`);
    }
  }

  // 変数アニメーションの補間処理
  private applyVariableAnimations(snapshot: StateSnapshot, time: number): void {
    // startAnimationとendAnimationのペアを見つけて補間
    const animationEvents = this.timeline.filter(
      (event) => event.action === "startAnimation" || event.action === "endAnimation"
    );

    // 変数ごとにアニメーションをグループ化
    const animationsByVariable = new Map<string, TimelineEvent[]>();

    animationEvents.forEach((event) => {
      const variable = event.args.variable as string;
      if (!animationsByVariable.has(variable)) {
        animationsByVariable.set(variable, []);
      }
      animationsByVariable.get(variable)!.push(event);
    });

    // 各変数のアニメーションを処理
    for (const [variable, events] of animationsByVariable) {
      // 時刻順にソート
      events.sort((a, b) => a.time - b.time);

      // 現在時刻で有効なアニメーションを探す
      for (let i = 0; i < events.length - 1; i++) {
        const startEvent = events[i];
        const endEvent = events[i + 1];

        if (
          startEvent.action === "startAnimation" &&
          endEvent.action === "endAnimation" &&
          time >= startEvent.time &&
          time <= endEvent.time
        ) {
          // 補間処理
          const progress = (time - startEvent.time) / (endEvent.time - startEvent.time);
          const startValue = startEvent.args.startValue as number;
          const endValue = startEvent.args.endValue as number;

          // 線形補間（後でイージング関数を追加可能）
          const interpolatedValue = startValue + (endValue - startValue) * progress;

          snapshot.variables[variable] = interpolatedValue;
          break;
        }
      }
    }
  }
}
