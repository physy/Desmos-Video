import type { FormulaElement, SubtitleElement } from '../types/formula';

// Canvas レンダリング用の型定義
interface GraphBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Point {
  x: number;
  y: number;
}

// SVG 描画アニメーション適用関数
export const applySVGDrawAnimation = (
  svgElement: Element,
  pathFillAnimationEnabled: boolean,
  strokeColor?: string,
  targetColor?: string
): void => {
  // SVGアニメーション処理は引き続きメインコンポーネントで実装
};

// Canvas にオーバーレイをレンダリングする関数
export const renderOverlayToCanvas = async (
  canvas: HTMLCanvasElement,
  elements: { formulas: FormulaElement[]; subtitles: SubtitleElement[] },
  currentTime: number,
  graphBounds: GraphBounds,
  pathFillAnimationEnabled: boolean,
  strokeColor?: string
): Promise<void> => {
  // この関数は後でOverlayRenderer.tsxから移動
  console.log("renderOverlayToCanvas called with:", { elements, currentTime });
};
