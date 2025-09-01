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
  // UI Components
  keypad?: boolean;
  graphpaper?: boolean;
  expressions?: boolean;
  settingsMenu?: boolean;
  zoomButtons?: boolean;
  showResetButtonOnGraphpaper?: boolean;
  expressionsTopbar?: boolean;
  pointsOfInterest?: boolean;
  trace?: boolean;
  border?: boolean;
  lockViewport?: boolean;
  expressionsCollapsed?: boolean;
  showIDs?: boolean;
  capExpressionSize?: boolean;
  authorFeatures?: boolean;
  images?: boolean;
  imageUploadCallback?: (
    file: File,
    callback: (error: boolean | null, url?: string) => void
  ) => void;
  folders?: boolean;
  notes?: boolean;
  sliders?: boolean;
  actions?: "auto" | boolean;
  substitutions?: boolean;
  links?: boolean;
  qwertyKeyboard?: boolean;
  distributions?: boolean;
  restrictedFunctions?: boolean;
  forceEnableGeometryFunctions?: boolean;
  pasteGraphLink?: boolean;
  pasteTableData?: boolean;
  clearIntoDegreeMode?: boolean;
  colors?: Record<string, string>;
  autosize?: boolean;
  plotInequalities?: boolean;
  plotImplicits?: boolean;
  plotSingleVariableImplicitEquations?: boolean;
  projectorMode?: boolean;
  decimalToFraction?: boolean;
  fontSize?: number;
  invertedColors?: boolean;
  language?: string;
  brailleMode?: "nemeth" | "ueb" | "none";
  sixKeyInput?: boolean;
  brailleControls?: boolean;
  audio?: boolean;
  graphDescription?: string;
  zoomFit?: boolean;
  forceLogModeRegressions?: boolean;
  defaultLogModeRegressions?: boolean;
  customRegressions?: boolean;
  regressionTemplates?: boolean;
  logScales?: boolean;
  tone?: boolean;
  intervalComprehensions?: boolean;
  muted?: boolean;
  allowComplex?: boolean;
  reportPosition?: "coordinates" | "percents" | "default";
  showEvaluationCopyButtons?: boolean;
  onEvaluationCopyClick?: (latex: string) => void;
  recursion?: boolean;

  // Axis Settings
  xAxisNumbers?: boolean;
  yAxisNumbers?: boolean;
  polarNumbers?: boolean;
  xAxisStep?: number;
  yAxisStep?: number;
  xAxisMinorSubdivisions?: number;
  yAxisMinorSubdivisions?: number;
  xAxisArrowMode?: "NONE" | "POSITIVE" | "BOTH";
  yAxisArrowMode?: "NONE" | "POSITIVE" | "BOTH";
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisScale?: "linear" | "logarithmic";
  yAxisScale?: "linear" | "logarithmic";

  // Graph Settings
  degreeMode?: boolean;
  showGrid?: boolean;
  polarMode?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  randomSeed?: string;

  // Legacy/Deprecated
  backgroundColor?: string;
  branding?: boolean;
  mathBounds?: MathBounds;
}

export interface Calculator {
  asyncScreenshot: (
    options?: {
      width?: number;
      height?: number;
      showLabels?: boolean;
      targetPixelRatio?: number;
    },
    callback?: (url: string) => void
  ) => void;
  setExpression: (expression: Partial<DesmosExpression>) => void;
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
  resize: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controller: any;
  // controller.graphSettings の主なプロパティ:
  // axisLineOffset: offset of axis lines, presumably in px. default value 0.25
  // axisLineWidth: width of axis lines, presumably in px. default value 1.5;
  // axisOpacity: axis line opacity. default value 0.9;
  // config: lean version of Calc.settings
  // curveOpacity: doesn’t appear to do anything, probably used to be curve opacity before the advanced styling update. default value 0.7
  // disableFill: disables fill. default value false.
  // globalCurveColor: appears to do nothing, default value undefined.
  // graphLineWidth: another likely relic from the pre-AS days. default value 2.5.
  // highlight: no clue. default value false.
  // labelHangingColor: angle label color for polar mode. default value "rgba(150,150,150,1)".
  // labelSize: size of all graph labels. default value 14.
  // lastChangedAxis: controls which axis is preserved when changing graph window size. default value “x”.
  // majorAxisOpacity: opacity of major axis. default value 0.4.
  // minorAxisOpacity: opacity of minor axis. default value 0.12.
  // pixelsPerLabel: amount of pixels reserved for each graph label. default value 80.
  // pointLineWidth: probably another pre-AS relic. Default value 9.
  // squareAxes: indicates if the axes form squares. If not, a “Zoom squares” button appears in the regular graph settings.
  observeEvent: (event: string, callback: (...args: unknown[]) => void) => void;
  unobserveEvent: (event: string, callback: (...args: unknown[]) => void) => void;
}
