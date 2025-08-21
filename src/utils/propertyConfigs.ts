// プロパティ設定の型定義
export interface PropertyConfig {
  label: string;
  type:
    | "boolean"
    | "string"
    | "number"
    | "color"
    | "select"
    | "range"
    | "textarea"
    | "object"
    | "array";
  defaultValue: unknown;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  objectFields?: Record<string, Omit<PropertyConfig, "label">>;
  arrayItemType?: "string" | "object";
  arrayItemFields?: Record<string, Omit<PropertyConfig, "label">>;
}

// 主要なDesmosプロパティの設定
export const PROPERTY_CONFIGS: Record<string, PropertyConfig> = {
  // 基本プロパティ
  id: {
    label: "ID",
    type: "string",
    defaultValue: "",
    placeholder: "expression-id",
  },
  type: {
    label: "タイプ",
    type: "select",
    defaultValue: "expression",
    options: [
      { value: "expression", label: "Expression" },
      { value: "table", label: "Table" },
      { value: "text", label: "Text" },
      { value: "folder", label: "Folder" },
    ],
  },
  latex: {
    label: "LaTeX式",
    type: "textarea",
    defaultValue: "y = x",
    placeholder: "y = x^2",
  },

  // ビジュアルプロパティ
  color: {
    label: "色",
    type: "color",
    defaultValue: "#2563eb",
  },
  hidden: {
    label: "非表示",
    type: "boolean",
    defaultValue: false,
  },
  secret: {
    label: "シークレット",
    type: "boolean",
    defaultValue: false,
  },

  // 線のプロパティ
  lineStyle: {
    label: "線のスタイル",
    type: "select",
    defaultValue: "SOLID",
    options: [
      { value: "SOLID", label: "実線" },
      { value: "DASHED", label: "破線" },
      { value: "DOTTED", label: "点線" },
    ],
  },
  lineWidth: {
    label: "線の太さ",
    type: "range",
    defaultValue: 2.5,
    min: 0.5,
    max: 10,
    step: 0.5,
  },
  lineOpacity: {
    label: "線の透明度",
    type: "range",
    defaultValue: 0.9,
    min: 0,
    max: 1,
    step: 0.01,
  },
  lines: {
    label: "ライン表示",
    type: "boolean",
    defaultValue: true,
  },

  // ポイントのプロパティ
  pointStyle: {
    label: "ポイントスタイル",
    type: "select",
    defaultValue: "POINT",
    options: [
      { value: "POINT", label: "Point" },
      { value: "OPEN", label: "Open" },
      { value: "CROSS", label: "Cross" },
    ],
  },
  pointSize: {
    label: "ポイントサイズ",
    type: "range",
    defaultValue: 9,
    min: 1,
    max: 20,
    step: 1,
  },
  movablePointSize: {
    label: "移動可能ポイントサイズ",
    type: "range",
    defaultValue: 9,
    min: 1,
    max: 20,
    step: 1,
  },
  pointOpacity: {
    label: "ポイント透明度",
    type: "range",
    defaultValue: 0.9,
    min: 0,
    max: 1,
    step: 0.01,
  },
  points: {
    label: "ポイント表示",
    type: "boolean",
    defaultValue: true,
  },

  // 塗りつぶしプロパティ
  fillOpacity: {
    label: "塗りつぶし透明度",
    type: "range",
    defaultValue: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
  },
  fill: {
    label: "塗りつぶし",
    type: "boolean",
    defaultValue: false,
  },

  // フォルダプロパティ
  folderId: {
    label: "フォルダID",
    type: "string",
    defaultValue: "",
    placeholder: "folder-1",
  },
  title: {
    label: "タイトル",
    type: "string",
    defaultValue: "",
    placeholder: "フォルダタイトル",
  },
  collapsed: {
    label: "折りたたみ",
    type: "boolean",
    defaultValue: false,
  },

  // ラベルプロパティ
  label: {
    label: "ラベルテキスト",
    type: "string",
    defaultValue: "",
    placeholder: "ラベル名",
  },
  showLabel: {
    label: "ラベル表示",
    type: "boolean",
    defaultValue: false,
  },
  labelSize: {
    label: "ラベルサイズ",
    type: "select",
    defaultValue: "medium",
    options: [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
  },
  labelOrientation: {
    label: "ラベル配置",
    type: "select",
    defaultValue: "default",
    options: [
      { value: "default", label: "Default" },
      { value: "center", label: "Center" },
      { value: "center_auto", label: "Center Auto" },
      { value: "auto_center", label: "Auto Center" },
      { value: "above", label: "Above" },
      { value: "above_left", label: "Above Left" },
      { value: "above_right", label: "Above Right" },
      { value: "below", label: "Below" },
      { value: "below_left", label: "Below Left" },
      { value: "below_right", label: "Below Right" },
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
  },

  // ドラッグモードプロパティ
  dragMode: {
    label: "ドラッグモード",
    type: "select",
    defaultValue: "NONE",
    options: [
      { value: "NONE", label: "None" },
      { value: "X", label: "X方向" },
      { value: "Y", label: "Y方向" },
      { value: "XY", label: "XY方向" },
      { value: "AUTO", label: "Auto" },
    ],
  },

  // スライダープロパティ
  slider: {
    label: "スライダー設定",
    type: "object",
    defaultValue: {
      min: "0",
      max: "10",
      step: "1",
      animationPeriod: 4000,
    },
    objectFields: {
      min: {
        type: "string",
        defaultValue: "0",
        placeholder: "0",
      },
      max: {
        type: "string",
        defaultValue: "10",
        placeholder: "10",
      },
      step: {
        type: "string",
        defaultValue: "1",
        placeholder: "0.1",
      },
      animationPeriod: {
        type: "number",
        defaultValue: 4000,
        min: 100,
        max: 10000,
        step: 100,
      },
    },
  },

  // ドメインプロパティ
  parametricDomain: {
    label: "パラメトリック範囲",
    type: "object",
    defaultValue: {
      min: "0",
      max: "1",
    },
    objectFields: {
      min: {
        type: "string",
        defaultValue: "0",
        placeholder: "0",
      },
      max: {
        type: "string",
        defaultValue: "1",
        placeholder: "2\\pi",
      },
    },
  },

  polarDomain: {
    label: "極座標範囲",
    type: "object",
    defaultValue: {
      min: "0",
      max: "1",
    },
    objectFields: {
      min: {
        type: "string",
        defaultValue: "0",
        placeholder: "0",
      },
      max: {
        type: "string",
        defaultValue: "1",
        placeholder: "2\\pi",
      },
    },
  },

  // テーブル列プロパティ
  columns: {
    label: "テーブル列",
    type: "array",
    defaultValue: [],
    arrayItemType: "object",
    arrayItemFields: {
      latex: {
        type: "string",
        defaultValue: "",
        placeholder: "x_1",
      },
      values: {
        type: "array",
        defaultValue: [],
        arrayItemType: "string",
      },
      color: {
        type: "color",
        defaultValue: "#2563eb",
      },
      dragMode: {
        type: "select",
        defaultValue: "NONE",
        options: [
          { value: "NONE", label: "None" },
          { value: "X", label: "X方向" },
          { value: "Y", label: "Y方向" },
          { value: "XY", label: "XY方向" },
          { value: "AUTO", label: "Auto" },
        ],
      },
      columnMode: {
        type: "select",
        defaultValue: "POINTS",
        options: [
          { value: "POINTS", label: "Points" },
          { value: "LINES", label: "Lines" },
          { value: "POINTS_AND_LINES", label: "Points and Lines" },
        ],
      },
      pointStyle: {
        type: "select",
        defaultValue: "POINT",
        options: [
          { value: "POINT", label: "Point" },
          { value: "OPEN", label: "Open" },
          { value: "CROSS", label: "Cross" },
        ],
      },
      lineStyle: {
        type: "select",
        defaultValue: "SOLID",
        options: [
          { value: "SOLID", label: "実線" },
          { value: "DASHED", label: "破線" },
          { value: "DOTTED", label: "点線" },
        ],
      },
    },
  },

  // アニメーション・スライダープロパティ
  playing: {
    label: "再生中",
    type: "boolean",
    defaultValue: false,
  },

  // 削除された旧スライダープロパティ（複合オブジェクトに統合済み）
  // sliderMin, sliderMax, sliderStep, sliderAnimationPeriod は削除

  // 削除された旧ドメインプロパティ（複合オブジェクトに統合済み）
  // parametricDomainMin, parametricDomainMax, polarDomainMin, polarDomainMax は削除

  // テキストプロパティ
  text: {
    label: "テキスト",
    type: "textarea",
    defaultValue: "",
    placeholder: "テキストを入力",
  },
};
