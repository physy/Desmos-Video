import type { Calculator, DesmosState } from "./desmos";

// Desmosの実際の Expression structure に基づく包括的な interface
export interface DesmosExpression {
  id: string;
  type?: "expression" | "table" | "text" | "folder";

  // Expression specific properties
  latex?: string;
  color?: string;
  lineStyle?: "SOLID" | "DASHED" | "DOTTED";
  lineWidth?: number | string;
  lineOpacity?: number | string;
  pointStyle?: "POINT" | "OPEN" | "CROSS";
  pointSize?: number | string;
  movablePointSize?: number | string;
  pointOpacity?: number | string;
  fillOpacity?: number | string;
  points?: boolean;
  lines?: boolean;
  fill?: boolean;
  hidden?: boolean;
  secret?: boolean;

  // Folder specific properties
  folderId?: string;
  title?: string;
  collapsed?: boolean;

  // Slider properties
  slider?: {
    min?: string;
    max?: string;
    step?: string;
  };

  // Other Desmos properties
  playing?: boolean;
  parametricDomain?: {
    min: string;
    max: string;
  };
  polarDomain?: {
    min: string;
    max: string;
  };
  dragMode?: "NONE" | "X" | "Y" | "XY" | "AUTO";
  label?: string;
  showLabel?: boolean;
  labelSize?: string;
  labelOrientation?:
    | "default"
    | "center"
    | "center_auto"
    | "auto_center"
    | "above"
    | "above_left"
    | "above_right"
    | "below"
    | "below_left"
    | "below_right"
    | "left"
    | "right";

  // Table specific properties
  columns?: Array<{
    latex: string;
    values?: string[];
    color?: string;
    dragMode?: "NONE" | "X" | "Y" | "XY" | "AUTO";
    columnMode?: "POINTS" | "LINES" | "POINTS_AND_LINES";
    pointStyle?: "POINT" | "OPEN" | "CROSS";
    lineStyle?: "SOLID" | "DASHED" | "DOTTED";
  }>;

  // Text specific properties
  text?: string;
}

// 統合されたイベント型 - すべてのイベントを一つの型で管理
export interface UnifiedEvent {
  id: string;
  time: number;
  type: "expression" | "bounds" | "animation";
  // Expression event properties
  expressionId?: string;
  properties?: Partial<DesmosExpression>;
  // Bounds event properties
  bounds?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  // Animation event properties
  animation?: {
    variable: string;
    startValue: number;
    endValue: number;
    duration: number;
  };
}

// Legacy compatibility - 既存のコードとの互換性のため
export interface ExpressionEvent {
  time: number;
  type: "expression";
  id: string; // expression ID
  properties: Partial<DesmosExpression>; // 変更するプロパティ
}

export interface TimelineEvent {
  time: number;
  action: "setExpression" | "setMathBounds" | "startAnimation" | "endAnimation";
  args: Record<string, unknown>;
  id?: string;
}

// 新しいStateEventインターface
export interface StateEvent {
  time: number;
  type: "state";
  state: DesmosState;
  id?: string;
  description?: string;
}

// 統合されたタイムラインアイテム
export type TimelineItem = TimelineEvent | StateEvent | ExpressionEvent;

export interface ContinuousEvent {
  startTime: number;
  duration: number;
  variable: string;
  startValue: number;
  endValue: number;
  easingFunction?: (t: number) => number;
  id?: string;
  active?: boolean;
}

export interface AnimationEvent {
  time: number;
  type: "animation";
  variable: string;
  startValue?: number;
  endValue?: number;
  duration?: number;
  id?: string;
}

export interface AnimationProject {
  initialState: DesmosState;
  timeline: TimelineEvent[];
  stateEvents: StateEvent[];
  continuousEvents: ContinuousEvent[];
  duration: number;
  fps?: number;
}

export interface CheckpointState {
  time: number;
  state: DesmosState;
}

export interface StateCache {
  snapshots: Map<number, DesmosState>;
  lastCalculatedTime: number;
}

export interface StateManager {
  getStateAtTime: (time: number) => DesmosState;
  createCheckpoint: (time: number, state: DesmosState) => void;
  clearCache: () => void;
  applyStateToCalculator: (state: DesmosState, calculator: Calculator) => void;
}
