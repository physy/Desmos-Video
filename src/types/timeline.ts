import type { Calculator } from "./desmos";

export interface TimelineEvent {
  time: number;
  action:
    | "setHidden"
    | "addExpression"
    | "removeExpression"
    | "updateExpression"
    | "startAnimation"
    | "endAnimation"
    | "setVariable"
    | "setBounds"
    | string;
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
export type TimelineItem = TimelineEvent | StateEvent;

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

export interface DesmosExpression {
  id: string;
  latex: string;
  hidden?: boolean;
  color?: string;
  lineStyle?: string;
  lineWidth?: number;
}

export interface DesmosState {
  expressions: DesmosExpression[];
  mathBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  settings: Record<string, string | number | boolean>;
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

export interface StateSnapshot {
  time: number;
  expressions: DesmosExpression[];
  mathBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  settings: Record<string, string | number | boolean>;
  variables: Record<string, number>;
}

export interface StateCache {
  snapshots: Map<number, StateSnapshot>;
  lastCalculatedTime: number;
}

export interface StateManager {
  getStateAtTime: (time: number) => StateSnapshot;
  createCheckpoint: (time: number, state: DesmosState) => void;
  clearCache: () => void;
  applyStateToCalculator: (state: StateSnapshot, calculator: Calculator) => void;
}
