import type { Calculator, DesmosState } from "./desmos";
import type { FormulaElement, SubtitleElement } from "./formula";

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
  frame: number;
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
    animationPeriod?: number;
  };
  sliderBounds?: {
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
  frame: number;
  type: "expression" | "bounds" | "animation";
  // Expression event properties
  properties?: Partial<DesmosExpression>;
  // Bounds event properties
  bounds?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    zmin?: number; // 3Dグラフの場合のz軸最小値
    zmax?: number; // 3Dグラフの場合のz軸最大値
  };
  // Animation event properties - フレーム数基準
  animation?: {
    type: "variable" | "property" | "action" | "bounds" | "rotation";
    targetId: string; // 対象のexpression ID
    durationFrames: number; // アニメーションフレーム数

    // 変数アニメーション用
    variable?: {
      name: string; // 変数名（latexから自動取得も可能）
      startValue: number;
      endValue: number;
      autoDetect?: boolean; // latexから変数名を自動検出するか
    };

    // プロパティアニメーション用
    property?: {
      name: string; // プロパティ名（例: "lineOpacity", "pointSize"など）
      startValue: number;
      endValue: number;
    };

    // アクションアニメーション用
    action?: {
      steps: number; // 実行するステップ数
      frameInterval: number; // 何フレームごとに実行するか
    };

    // バウンズアニメーション用
    bounds?: {
      // スケールアニメーション（アスペクト比保持）
      scale?: {
        endValue: number; // 終了時のスケール倍率
        centerX?: number; // スケールの中心X座標（デフォルト: 現在のビュー中心）
        centerY?: number; // スケールの中心Y座標（デフォルト: 現在のビュー中心）
        centerZ?: number; // 3D用：スケールの中心Z座標（デフォルト: 現在のビュー中心）
      };

      // 並進移動
      translation?: {
        endX: number; // 終了時のX位置
        endY: number; // 終了時のY位置
        endZ?: number; // 3D用：終了時のZ位置（オプション）
        mode: "displacement" | "absolute"; // 変位指定 or 絶対座標指定
      };

      // 直接的なバウンズ指定（従来の動作）
      direct?: {
        endBounds: {
          left: number;
          right: number;
          top: number;
          bottom: number;
          zmin?: number;
          zmax?: number;
        };
      };
    };

    // 3D回転アニメーション用（相対回転のみ - どれだけ回転するかを指定）
    rotation?: {
      // 回転方式の選択
      mode: "axis" | "euler";

      // 軸回転モード（mode="axis"）- どれだけ回転するかを指定
      axis?: {
        x: number; // 回転軸のX成分
        y: number; // 回転軸のY成分
        z: number; // 回転軸のZ成分
        angle: number; // 回転角度（ラジアン）
      };

      // オイラー角モード（mode="euler"）- どれだけ回転するかを指定
      euler?: {
        x: number; // X軸回りの回転（ラジアン）
        y: number; // Y軸回りの回転（ラジアン）
        z: number; // Z軸回りの回転（ラジアン）
        order: "XYZ" | "YXZ" | "ZXY" | "ZYX" | "YZX" | "XZY"; // 回転順序
      };

      // 補間された行列（内部使用用）
      interpolatedMatrix?: [number, number, number, number, number, number, number, number, number];
    };

    // イージング関数
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";

    // 解像度・ピクセル比
    width?: number;
    height?: number;
    pixelRatio?: number;
  };
}

// Legacy compatibility - 既存のコードとの互換性のため
export interface ExpressionEvent {
  frame: number;
  type: "expression";
  id: string; // expression ID
  properties: Partial<DesmosExpression>; // 変更するプロパティ
}

export interface TimelineEvent {
  frame: number;
  action: "setExpression" | "setMathBounds" | "startAnimation" | "endAnimation";
  args: Record<string, unknown>;
  id: string;
}

// 新しいStateEventインターface
export interface StateEvent {
  frame: number;
  type: "state";
  state: DesmosState;
  id: string;
  description?: string;
}

// 統合されたタイムラインアイテム
export type TimelineItem = TimelineEvent | StateEvent | ExpressionEvent;

export interface AnimationEvent {
  frame: number;
  type: "animation";
  variable: string;
  startValue?: number;
  endValue?: number;
  durationFrames?: number;
  id?: string;
}

import type { GraphSettings } from "../utils/calculatorInitializer";
import type { GraphingCalculatorOptions } from "./desmos";

export interface AnimationProject {
  timeline: TimelineEvent[];
  stateEvents: StateEvent[];
  graphSettings?: GraphSettings;
  videoExportSettings?: VideoExportSettings;
  calculatorOptions?: GraphingCalculatorOptions & { graphType?: "2d" | "3d" };
  // 数式・字幕データ
  formulas?: FormulaElement[];
  subtitles?: SubtitleElement[];
}

export interface CheckpointState {
  frame: number;
  state: DesmosState;
}

export interface StateCache {
  snapshots: Map<number, DesmosState>;
  lastCalculatedFrame: number;
}

export interface StateManager {
  getStateAtFrame: (frame: number) => DesmosState;
  createCheckpoint: (frame: number, state: DesmosState) => void;
  clearCache: () => void;
  applyStateToCalculator: (state: DesmosState, calculator: Calculator) => void;
}

// 動画エクスポート設定の型定義
export interface VideoExportSettings {
  // 基本設定
  durationFrames: number; // フレーム数
  fps: number; // フレームレート

  // 解像度設定
  resolution: {
    width: number;
    height: number;
    preset?: "custom" | "720p" | "1080p" | "1440p" | "4k" | "square" | "vertical";
  };

  // 品質設定
  quality: {
    bitrate?: number; // kbps
    preset: "draft" | "standard" | "high" | "ultra";
  };

  // フォーマット設定
  format: {
    container: "mp4" | "webm" | "gif";
    codec?: "h264" | "h265" | "vp8" | "vp9";
  };

  // 詳細設定
  advanced: {
    targetPixelRatio: number; // スクリーンショット用
    backgroundColor?: string;
    antialias: boolean;
    motionBlur: boolean;
    frameInterpolation: boolean;
  };

  // グラフの配置設定
  graphPlacement?: {
    scale?: number; // グラフの拡大率 (デフォルト: 1.0)
    offsetX?: number; // X方向のオフセット (ピクセル)
    offsetY?: number; // Y方向のオフセット (ピクセル)
  };

  // メタデータ
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
}
