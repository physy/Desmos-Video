// Desmos Graphing Calculator API types
import type { DesmosExpression } from "./timeline";

declare global {
  interface Window {
    Desmos: {
      GraphingCalculator: (elt: HTMLElement, options?: GraphingCalculatorOptions) => Calculator;
    };
  }
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
  mathBounds?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
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
  setMathBounds: (bounds: { left: number; right: number; top: number; bottom: number }) => void;
  getExpressions: () => DesmosExpression[];
  getState: () => unknown;
  setState: (state: unknown) => void;
  updateSettings: (settings: Record<string, unknown>) => void;
  graphpaperBounds: {
    mathCoordinates: {
      left: number;
      right: number;
      top: number;
      bottom: number;
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
