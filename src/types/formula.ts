// 数式アニメーション関連の型定義

export interface FormulaElement {
  id: string;
  content: string; // LaTeX形式の数式
  position: {
    x: number; // グラフ座標系での位置
    y: number;
  };
  style: {
    fontSize: number; // ピクセル単位
    color: string;
    backgroundColor?: string;
    opacity: number;
    rotation?: number; // 度数
    scale: number;
  };
  animation?: {
    type: "typewriter" | "fade" | "slide" | "scale" | "none";
    duration: number; // アニメーション時間（フレーム数）
    delay?: number; // アニメーション開始遅延（フレーム数）
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  };
  exitAnimation?: {
    type: "fade" | "slide" | "scale" | "none";
    duration: number; // 消失アニメーション時間（フレーム数）
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  };
  visible: boolean;
  frame: number; // このフォーミュラが開始するフレーム
  displayDuration?: number; // 表示継続時間（フレーム数）。未指定の場合は無限
}

export interface SubtitleElement {
  id: string;
  text: string;
  position: {
    x: number; // 画面座標（0-1の相対位置）
    y: number;
  };
  style: {
    fontSize: number;
    color: string;
    backgroundColor?: string;
    opacity: number;
    fontFamily?: string;
    fontWeight?: "normal" | "bold";
    textAlign?: "left" | "center" | "right";
  };
  animation?: {
    type: "typewriter" | "fade" | "slide" | "none";
    duration: number; // アニメーション時間（フレーム数）
    delay?: number; // アニメーション開始遅延（フレーム数）
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  };
  exitAnimation?: {
    type: "fade" | "slide" | "scale" | "none";
    duration: number; // 消失アニメーション時間（フレーム数）
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  };
  visible: boolean;
  frame: number; // この字幕が開始するフレーム
  displayDuration?: number; // 表示継続時間（フレーム数）。未指定の場合は無限
}

// アニメーション状態
export interface AnimationState {
  frame: number;
  progress: number; // 0-1
  visible: boolean;
  enterProgress?: number; // 出現アニメーションの進行状況 (0-1)
  exitProgress?: number; // 消去アニメーションの進行状況 (0-1)
}

// フォーミュラアニメーションのイベント
export interface FormulaEvent {
  id: string;
  frame: number;
  type: "formula" | "subtitle";
  action: "show" | "hide" | "update";
  elementId: string;
  properties?: Partial<FormulaElement | SubtitleElement>;
}
