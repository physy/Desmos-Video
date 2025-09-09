import type { Calculator, GraphingCalculatorOptions } from "../types/desmos";

// GraphSettings型の定義（GraphSettingsPanelから移植）
export interface GraphSettings {
  axisLineWidth: number;
  axisLineOffset: number;
  axisOpacity: number;
  curveOpacity: number;
  disableFill: boolean;
  graphLineWidth: number;
  highlight: boolean;
  labelHangingColor: string;
  labelSize: number;
  lastChangedAxis: string;
  majorAxisOpacity: number;
  minorAxisOpacity: number;
  pixelsPerLabel: number;
  pointLineWidth: number;
  squareAxes: boolean;
}

// GraphSettingsのデフォルト値
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  axisLineWidth: 1.5,
  axisLineOffset: 0.25,
  axisOpacity: 0.9,
  curveOpacity: 0.7,
  disableFill: false,
  graphLineWidth: 2.5,
  highlight: false,
  labelHangingColor: "rgba(150,150,150,1)",
  labelSize: 30,
  lastChangedAxis: "x",
  majorAxisOpacity: 0.4,
  minorAxisOpacity: 0.12,
  pixelsPerLabel: 80,
  pointLineWidth: 9,
  squareAxes: false,
};

// スクリーンショット専用calculatorの初期化オプション
interface ScreenshotCalculatorOptions {
  calculatorOptions?: GraphingCalculatorOptions & { graphType?: "2d" | "3d" };
  graphSettings?: GraphSettings;
  width?: number;
  height?: number;
  containerId?: string;
}

// GraphSettingsをcalculatorに適用する関数
export function applyGraphSettings(calculator: Calculator, settings: GraphSettings): void {
  if (!calculator || !calculator.controller || !calculator.controller.graphSettings) {
    console.warn("Calculator or graphSettings not available for applying settings");
    return;
  }

  try {
    const gs = calculator.controller.graphSettings as Partial<GraphSettings>;

    // 設定をTypeScriptの型チェックに適合するように適用
    (Object.keys(settings) as (keyof GraphSettings)[]).forEach((key) => {
      const value = settings[key];
      if (typeof value === "number") {
        (gs[key] as number | undefined) = value as number;
      } else if (typeof value === "boolean") {
        (gs[key] as boolean | undefined) = value as boolean;
      } else {
        (gs[key] as string | undefined) = value as string;
      }
    });

    console.log("Graph settings applied to calculator:", settings);
  } catch (error) {
    console.error("Error applying graph settings to calculator:", error);
  }
}

// スクリーンショット専用calculatorを作成・初期化する関数
export function createScreenshotCalculator(
  options: ScreenshotCalculatorOptions = {}
): Calculator | null {
  if (!window.Desmos) {
    console.warn("Desmos API not loaded");
    return null;
  }

  const {
    calculatorOptions = {},
    graphSettings = DEFAULT_GRAPH_SETTINGS,
    width = 1920,
    height = 1080,
    containerId = `screenshot-calculator-${Date.now()}`,
  } = options;

  // 既存の同じIDのコンテナがあれば削除
  const existingContainer = document.getElementById(containerId);
  if (existingContainer) {
    existingContainer.remove();
  }

  // 非表示のコンテナを作成
  const hiddenContainer = document.createElement("div");
  hiddenContainer.id = containerId;
  hiddenContainer.style.position = "absolute";
  hiddenContainer.style.left = "-9999px";
  hiddenContainer.style.top = "-9999px";
  hiddenContainer.style.width = `${width}px`;
  hiddenContainer.style.height = `${height}px`;
  hiddenContainer.style.visibility = "hidden";
  hiddenContainer.style.pointerEvents = "none";
  hiddenContainer.setAttribute("data-screenshot-calculator", "true");
  document.body.appendChild(hiddenContainer);

  try {
    // スクリーンショット専用の最適化されたオプション
    const screenshotOptions: GraphingCalculatorOptions = {
      keypad: false,
      expressions: false, // UIを最小化してパフォーマンス向上
      settingsMenu: false,
      zoomButtons: false,
      expressionsTopbar: false,
      pointsOfInterest: false,
      trace: false,
      border: false,
      lockViewport: false,
      branding: false,
      pasteGraphLink: false,
      language: "ja",
      showGrid: false,
      showXAxis: false,
      showYAxis: false,
      ...calculatorOptions,
    };

    const { graphType, ...finalOptions } = screenshotOptions as GraphingCalculatorOptions & {
      graphType?: "2d" | "3d";
    };

    // graphTypeに基づいて適切なcalculatorを作成
    let calculator: Calculator | null = null;
    if (graphType === "3d" && window.Desmos.Calculator3D) {
      calculator = window.Desmos.Calculator3D(hiddenContainer, finalOptions);
    } else {
      calculator = window.Desmos.GraphingCalculator(hiddenContainer, finalOptions);
    }

    if (calculator) {
      // GraphSettingsを初期化
      applyGraphSettings(calculator, graphSettings);

      console.log(`Screenshot calculator created successfully (${graphType || "2d"})`, {
        containerId,
        dimensions: { width, height },
        graphSettings: graphSettings,
      });
      return calculator;
    } else {
      throw new Error("Failed to create calculator instance");
    }
  } catch (error) {
    console.error("Failed to create screenshot calculator:", error);
    // クリーンアップ
    hiddenContainer.remove();
    return null;
  }
}

// 古いスクリーンショット専用calculatorをクリーンアップする関数
export function cleanupScreenshotCalculators(): void {
  const existingContainers = document.querySelectorAll('[data-screenshot-calculator="true"]');
  existingContainers.forEach((container) => {
    container.remove();
    console.log("Removed existing screenshot calculator container");
  });
}

// スクリーンショット専用calculatorの管理クラス
export class ScreenshotCalculatorManager {
  private calculator: Calculator | null = null;
  private containerId: string;

  constructor(containerId = `screenshot-calculator-${Date.now()}`) {
    this.containerId = containerId;
  }

  // calculatorを初期化
  initialize(options: ScreenshotCalculatorOptions = {}): Calculator | null {
    // 既存のcalculatorを破棄
    this.destroy();

    // 新しいcalculatorを作成
    this.calculator = createScreenshotCalculator({
      ...options,
      containerId: this.containerId,
    });

    return this.calculator;
  }

  // calculatorを取得
  getCalculator(): Calculator | null {
    // destroy済みかどうか判定
    if (this.calculator) {
      try {
        this.calculator.getState();
        return this.calculator;
      } catch (e) {
        // destroy済み
        this.calculator = null;
        return null;
      }
    }
    return null;
  }

  // calculatorを破棄
  destroy(): void {
    if (this.calculator) {
      try {
        this.calculator.destroy();
        console.log("Screenshot calculator destroyed");
      } catch (error) {
        console.error("Error destroying screenshot calculator:", error);
      }
      this.calculator = null;
    }

    // コンテナも削除
    const container = document.getElementById(this.containerId);
    if (container) {
      container.remove();
    }
  }

  // calculatorを再作成（オプション変更時など）
  recreate(options: ScreenshotCalculatorOptions = {}): Calculator | null {
    console.log("Recreating screenshot calculator with new options");
    return this.initialize(options);
  }
}
