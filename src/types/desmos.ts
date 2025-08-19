// Desmos Graphing Calculator API types
import type { DesmosExpression } from "./timeline";

declare global {
  interface Window {
    Desmos: {
      GraphingCalculator: (elt: HTMLElement, options?: GraphingCalculatorOptions) => Calculator;
    };
  }
}

// 実際のDesmos状態の構造
export interface DesmosState {
  version: number;
  randomSeed: string;
  graph: {
    viewport: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
    showGrid?: boolean;
    showXAxis?: boolean;
    showYAxis?: boolean;
    complex?: boolean;
    __v12ViewportLatexStash?: {
      xmin: string;
      xmax: string;
      ymin: string;
      ymax: string;
    };
  };
  expressions: {
    list: DesmosExpression[];
    ticker?: {
      handlerLatex?: string;
      minStepLatex?: string;
      playing?: boolean;
      open?: boolean;
    };
  };
  includeFunctionParametersInRandomSeed?: boolean;
  doNotMigrateMovablePointStyle?: boolean;
}

// Math Bounds（互換性のため）
export interface MathBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GraphingCalculatorOptions {
  keypad?: boolean;
  expressions?: boolean;
  settingsMenu?: boolean;
  zoomButtons?: boolean;
  expressionsTopbar?: boolean;
  pointsOfInterest?: boolean;
  trace?: boolean;
  border?: boolean;
  lockViewport?: boolean;
  xAxisNumbers?: boolean;
  yAxisNumbers?: boolean;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  fontSize?: number;
  backgroundColor?: string;
  branding?: boolean;
  mathBounds?: MathBounds;
}

export interface Calculator {
  setExpression: (expression: {
    id: string;
    latex: string;
    hidden?: boolean;
    color?: string;
    lineStyle?: string;
    lineWidth?: number;
  }) => void;
  removeExpression: (options: { id: string }) => void;
  setMathBounds: (bounds: MathBounds) => void;
  getExpressions: () => DesmosExpression[];
  getState: () => DesmosState;
  setState: (state: DesmosState) => void;
  updateSettings: (settings: Record<string, unknown>) => void;
  graphpaperBounds: {
    mathCoordinates: MathBounds & {
      width: number;
      height: number;
    };
    pixelCoordinates: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      width: number;
      height: number;
    };
  };
  screenshot: (
    options?: {
      width?: number;
      height?: number;
      targetPixelRatio?: number;
    },
    callback?: (url: string) => void
  ) => void;
  destroy: () => void;
  observeEvent: (event: string, callback: (...args: unknown[]) => void) => void;
  unobserveEvent: (event: string, callback: (...args: unknown[]) => void) => void;
}
