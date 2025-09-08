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
    type: "fade" | "slide" | "scale" | "draw" | "none";
    duration: number; // アニメーション時間（フレーム数）
    delay?: number; // アニメーション開始遅延（フレーム数）
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    // スケールアニメーション用の原点設定
    scaleOrigin?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    // drawアニメーション用のオプション
    drawOptions?: {
      sequentialChars: boolean; // true: 文字を順番に表示, false: 全文字同時
      strokeDuration: number; // 輪郭描画の継続時間（0-1の比率）
      fillDuration: number; // fill復元の継続時間（0-1の比率）
      overlapRatio?: number; // 文字間の重複率（0-1、0.3なら前の文字の70%完了時点で次開始）
    };
  };
  exitAnimation?: {
    type: "fade" | "slide" | "scale" | "none";
    duration: number; // 消失アニメーション時間（フレーム数）
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    // スケールアニメーション用の原点設定
    scaleOrigin?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
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
    type: "typewriter" | "fade" | "slide" | "scale" | "none";
    duration: number; // アニメーション時間（フレーム数）
    delay?: number; // アニメーション開始遅延（フレーム数）
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    // スケールアニメーション用の原点設定
    scaleOrigin?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  };
  exitAnimation?: {
    type: "fade" | "slide" | "scale" | "none";
    duration: number; // 消失アニメーション時間（フレーム数）
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    // スケールアニメーション用の原点設定
    scaleOrigin?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
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
