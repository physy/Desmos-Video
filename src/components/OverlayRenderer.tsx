import React, { useRef, useEffect, useState, useCallback } from "react";
import type { FormulaElement, SubtitleElement, AnimationState } from "../types/formula";

interface OverlayRendererProps {
  formulas: FormulaElement[];
  subtitles: SubtitleElement[];
  currentFrame: number;
  containerWidth: number;
  containerHeight: number;
  // エクスポート解像度とスケール情報
  exportWidth?: number;
  exportHeight?: number;
  displayScale?: number;
  displayOffsetX?: number;
  displayOffsetY?: number;
  className?: string;
  pixelRatio?: number; // 高解像度対応
  debug?: boolean; // デバッグモードの制御
  // 選択状態
  selectedElementId?: string | null;
  selectedElementType?: "formula" | "subtitle" | null;
  // インタラクティブ操作用のコールバック
  onFormulaUpdate?: (id: string, updates: Partial<FormulaElement>) => void;
  onSubtitleUpdate?: (id: string, updates: Partial<SubtitleElement>) => void;
  onElementSelect?: (id: string | null, type: "formula" | "subtitle" | null) => void;
}

// アニメーション計算ヘルパー
const calculateAnimationProgress = (
  element: FormulaElement | SubtitleElement,
  currentFrame: number
): AnimationState => {
  const startFrame = element.frame;
  const animation = element.animation;
  const exitAnimation = element.exitAnimation;

  // デバッグ情報
  if (animation?.type === "draw") {
    console.log(`🎬 Animation Progress Debug for ${element.id}:`);
    console.log(`  Current Frame: ${currentFrame}`);
    console.log(`  Start Frame: ${startFrame}`);
    console.log(`  Animation Type: ${animation.type}`);
    console.log(`  Animation Duration: ${animation.duration}`);
    console.log(`  Animation Delay: ${animation.delay || 0}`);
  }

  // 表示継続時間のチェック
  const displayEndFrame = element.displayDuration ? startFrame + element.displayDuration : Infinity;

  // 出現アニメーション
  let enterProgress = 1;
  let enterVisible = currentFrame >= startFrame;

  if (animation && animation.type !== "none") {
    const animationStartFrame = startFrame + (animation.delay || 0);
    const animationEndFrame = animationStartFrame + animation.duration;

    if (animation.type === "draw") {
      console.log(`  Animation Start Frame: ${animationStartFrame}`);
      console.log(`  Animation End Frame: ${animationEndFrame}`);
    }

    if (currentFrame < animationStartFrame) {
      enterProgress = 0;
      enterVisible = false;
    } else if (currentFrame < animationEndFrame) {
      const rawProgress = (currentFrame - animationStartFrame) / animation.duration;
      enterProgress = applyEasing(rawProgress, animation.easing);

      if (animation.type === "draw") {
        console.log(`  Raw Progress: ${rawProgress}`);
        console.log(`  Enter Progress: ${enterProgress}`);
      }
    }
  }

  // 消去アニメーション
  let exitProgress = 0;
  let exitVisible = true;

  if (exitAnimation && exitAnimation.type !== "none" && element.displayDuration) {
    const exitStartFrame = displayEndFrame - exitAnimation.duration;

    if (currentFrame >= displayEndFrame) {
      // 完全に非表示
      return {
        frame: currentFrame,
        progress: 0,
        visible: false,
        enterProgress: 1,
        exitProgress: 1,
      };
    } else if (currentFrame >= exitStartFrame) {
      // 消去アニメーション中
      const rawProgress = (currentFrame - exitStartFrame) / exitAnimation.duration;
      exitProgress = applyEasing(rawProgress, exitAnimation.easing);
      exitVisible = true;
    }
  } else if (currentFrame >= displayEndFrame) {
    // 消去アニメーションなしで表示継続時間を超えている場合は非表示
    return {
      frame: currentFrame,
      progress: 0,
      visible: false,
      enterProgress: 1,
      exitProgress: 1,
    };
  }

  // 最終的な可視性と進行状況を計算
  const finalProgress = enterProgress * (1 - exitProgress);
  const finalVisible = enterVisible && exitVisible && element.visible && finalProgress > 0;

  // drawアニメーションの場合は最終結果をログ出力
  if (animation?.type === "draw") {
    console.log(`  Final Progress: ${finalProgress}`);
    console.log(`  Final Visible: ${finalVisible}`);
    console.log(`  Enter Progress: ${enterProgress}`);
    console.log(`  Exit Progress: ${exitProgress}`);
    console.log(`---`);
  }

  return {
    frame: currentFrame,
    progress: Math.max(0, Math.min(1, finalProgress)),
    visible: finalVisible,
    enterProgress,
    exitProgress,
  };
};

// イージング関数のヘルパー
const applyEasing = (progress: number, easing?: string): number => {
  switch (easing) {
    case "ease-in":
      return progress * progress;
    case "ease-out":
      return 1 - Math.pow(1 - progress, 2);
    case "ease-in-out":
      return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    default:
      return progress;
  }
};

// タイプライターアニメーション用のテキスト分割
const getTypewriterText = (text: string, progress: number): string => {
  const targetLength = Math.floor(text.length * progress);
  return text.substring(0, targetLength);
};

// SVG描画アニメーション用のヘルパー関数
const applySVGDrawAnimation = (
  svgElement: HTMLElement,
  progress: number,
  options?: {
    sequentialChars: boolean;
    strokeDuration: number;
    fillDuration: number;
  },
  targetColor?: string // 目標色を追加
): HTMLElement => {
  const opts = {
    sequentialChars: true,
    strokeDuration: 0.6,
    fillDuration: 0.4,
    overlapRatio: 0.3, // デフォルトで30%の重複
    ...options,
  };

  // デバッグログを簡潔に
  if (progress === 0 || progress === 1) {
    console.log(
      `🎨 SVG Draw Animation - Progress: ${progress}, Options:`,
      opts,
      `Target Color: ${targetColor}`
    );
  }

  const clonedElement = svgElement.cloneNode(true) as HTMLElement;
  const svg = clonedElement.querySelector("svg");

  if (!svg) {
    console.warn("❌ No SVG element found");
    return clonedElement;
  }

  // MathJaxのSVGから描画可能な要素を取得（useやrect、textも含む）
  const drawableElements = svg.querySelectorAll(
    "path, line, polyline, polygon, circle, ellipse, rect, use, text"
  );

  // パス定義を収集（defsセクションから + グローバルなMathJaxの定義も含む）
  const defs = svg.querySelector("defs");
  const pathDefs = new Map<string, SVGPathElement>();

  // ローカルのdefs
  if (defs) {
    const definedPaths = defs.querySelectorAll("path[id]");
    definedPaths.forEach((path) => {
      const id = path.getAttribute("id");
      if (id) {
        pathDefs.set(`#${id}`, path as SVGPathElement);
      }
    });
  }

  // グローバルなMathJaxの定義を探す（ドキュメント全体から）
  const globalDefs = document.querySelectorAll("defs path[id], svg defs path[id]");
  globalDefs.forEach((path) => {
    const id = path.getAttribute("id");
    if (id && !pathDefs.has(`#${id}`)) {
      pathDefs.set(`#${id}`, path as SVGPathElement);
    }
  });

  // 文字要素（use要素とtext要素）のリストを作成
  const useElements = Array.from(drawableElements).filter((el) => el instanceof SVGUseElement);
  const textElements = Array.from(drawableElements).filter((el) => el instanceof SVGTextElement);

  // 全ての描画可能要素のリストを順番付きで作成（統一されたアニメーション管理のため）
  const allDrawableElements = Array.from(drawableElements);
  const totalElements = allDrawableElements.length;

  // 初回のみ詳細情報をログ出力
  if (progress === 0) {
    console.log(
      `🔤 Found ${useElements.length} use elements, ${textElements.length} text elements, ${totalElements} total drawable elements`
    );
  }

  let animatedCount = 0;

  drawableElements.forEach((element, index) => {
    const svgEl = element as SVGElement;
    let pathLength = 0;
    let canAnimate = false;
    const elementType = svgEl.tagName.toLowerCase();

    // 統一された要素インデックス（全要素での順番）
    const globalElementIndex = index;
    // use要素の場合のみ、use要素内での順番も取得
    const useElementIndex =
      svgEl instanceof SVGUseElement ? useElements.findIndex((el) => el === svgEl) : -1;
    // text要素の場合のみ、text要素内での順番も取得
    const textElementIndex =
      svgEl instanceof SVGTextElement ? textElements.findIndex((el) => el === svgEl) : -1;
    try {
      // パスの長さを計算
      if (svgEl instanceof SVGPathElement) {
        pathLength = svgEl.getTotalLength();
        canAnimate = true;
      } else if (svgEl instanceof SVGUseElement) {
        // use要素の場合、参照先のパスを確認
        const href = svgEl.getAttribute("href") || svgEl.getAttribute("xlink:href");

        if (href && pathDefs.has(href)) {
          const referencedPath = pathDefs.get(href);
          if (referencedPath) {
            try {
              pathLength = referencedPath.getTotalLength();
              canAnimate = true;
            } catch (e) {
              // 参照パスが取得できない場合はスキップ
            }
          }
        } else {
          // use要素自体にstroke-dasharrayを適用してみる（文字の場合は効果的ではないが試行）
          const bbox = svgEl.getBBox ? svgEl.getBBox() : null;
          if (bbox) {
            // 要素のバウンディングボックスから推定した長さを使用
            pathLength = 2 * (bbox.width + bbox.height);
            canAnimate = true;
          }
        }
      } else if (svgEl instanceof SVGLineElement) {
        const x1 = parseFloat(svgEl.getAttribute("x1") || "0");
        const y1 = parseFloat(svgEl.getAttribute("y1") || "0");
        const x2 = parseFloat(svgEl.getAttribute("x2") || "0");
        const y2 = parseFloat(svgEl.getAttribute("y2") || "0");
        pathLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        canAnimate = true;
      } else if (svgEl instanceof SVGRectElement) {
        const width = parseFloat(svgEl.getAttribute("width") || "0");
        const height = parseFloat(svgEl.getAttribute("height") || "0");
        // 矩形の周囲を描画する場合
        pathLength = 2 * (width + height);
        canAnimate = true;
      } else if (svgEl instanceof SVGCircleElement) {
        const r = parseFloat(svgEl.getAttribute("r") || "0");
        pathLength = 2 * Math.PI * r;
        canAnimate = true;
      } else if (svgEl instanceof SVGEllipseElement) {
        const rx = parseFloat(svgEl.getAttribute("rx") || "0");
        const ry = parseFloat(svgEl.getAttribute("ry") || "0");
        pathLength = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
        canAnimate = true;
      } else if (svgEl instanceof SVGTextElement) {
        const fontSizeAttr = svgEl.getAttribute("font-size");
        const width = parseFloat(fontSizeAttr || "0");
        if (width) {
          pathLength = 4 * width;
          canAnimate = true;
        }
        console.log(`🔤 Text Element Detected: "${svgEl.textContent}" ${pathLength}`);
        console.dir(svgEl);
      }

      if (canAnimate && pathLength > 0) {
        // 全要素での統一された順番表示設定を適用
        let elementStartTime = 0;
        let elementDuration = 1;

        if (opts.sequentialChars && totalElements > 1) {
          // 順番表示の場合: 各要素が重複しながらアニメーション
          const overlapRatio = opts.overlapRatio; // オプションから重複率を取得
          const baseElementDuration = 1 / (1 + (totalElements - 1) * (1 - overlapRatio));
          elementDuration = baseElementDuration;
          elementStartTime = globalElementIndex * baseElementDuration * (1 - overlapRatio);
        } else {
          // 同時表示の場合: 全要素が同時にアニメーション
          elementStartTime = 0;
          elementDuration = 1;
        }

        const elementEndTime = elementStartTime + elementDuration;

        // デバッグ: 最初の要素のみログ出力
        if (globalElementIndex === 0) {
          console.log(
            `🚀 Element ${globalElementIndex}/${totalElements}: sequential=${
              opts.sequentialChars
            }, start=${elementStartTime.toFixed(3)}, duration=${elementDuration.toFixed(3)}`
          );
        }

        if (progress < elementStartTime) {
          // まだ開始していない - 完全に非表示
          svgEl.style.visibility = "hidden";
        } else if (progress <= elementEndTime) {
          // この要素のアニメーション中
          svgEl.style.visibility = "visible";
          const elementProgress = (progress - elementStartTime) / elementDuration;

          // 重複2フェーズアニメーション: stroke開始 → fillも重複して開始 → stroke終了=fill終了でstroke非表示
          const strokeDuration = opts.strokeDuration;
          const fillDuration = opts.fillDuration;

          // fillの開始タイミングを調整（strokeが終わるのと同時にfillが完了するように）
          const fillStartTime = strokeDuration - fillDuration;
          const fillPhaseStart = Math.max(0, fillStartTime);
          const strokePhaseEnd = strokeDuration;

          // stroke フェーズ
          const strokeProgress = Math.min(1, Math.max(0, elementProgress / strokeDuration));
          const drawnLength = pathLength * strokeProgress;
          const remainingLength = Math.max(0, pathLength - drawnLength);

          // stroke-dasharrayとstroke-dashoffsetを設定
          svgEl.style.strokeDasharray = `${drawnLength} ${remainingLength}`;
          svgEl.style.strokeDashoffset = "0";

          // strokeが設定されていない場合は追加
          const currentStroke = svgEl.style.stroke || svgEl.getAttribute("stroke");
          if (!currentStroke || currentStroke === "none") {
            // targetColorが指定されている場合はそれを使用、なければcurrentColor
            svgEl.style.stroke = targetColor || "currentColor";
          }

          // fill フェーズ（重複実行）
          let fillProgress = 0;
          if (elementProgress >= fillPhaseStart) {
            fillProgress = Math.min(
              1,
              Math.max(0, (elementProgress - fillPhaseStart) / fillDuration)
            );
          }

          // strokeのフェードアウト（fillの進行に合わせて徐々に薄くする）
          const strokeOpacity = Math.max(0, 1 - fillProgress);

          // アニメーション完了判定
          const isAnimationComplete = elementProgress >= strokeDuration;

          if (isAnimationComplete) {
            // アニメーション完了 - 全てのアニメーションスタイルをリセット
            svgEl.style.fill = "";
            svgEl.style.fillOpacity = "";
            svgEl.style.stroke = "";
            svgEl.style.strokeOpacity = "";
            svgEl.style.strokeWidth = "";
            svgEl.style.strokeDasharray = "";
            svgEl.style.strokeDashoffset = "";
            svgEl.style.opacity = "1";
          } else {
            // アニメーション中
            svgEl.style.strokeWidth = "20";
            svgEl.style.opacity = "1";

            // strokeのスタイル設定（fillの進行に合わせて徐々にフェード）
            if (strokeOpacity > 0) {
              svgEl.style.stroke = targetColor || "currentColor";
              svgEl.style.strokeOpacity = strokeOpacity.toString();
            } else {
              svgEl.style.stroke = "none";
            }

            if (fillProgress > 0) {
              // fillが開始されている場合は設定された色で徐々に復元
              svgEl.style.fill = targetColor || "currentColor";
              svgEl.style.fillOpacity = fillProgress.toString();
            } else {
              // まだfillが開始されていない場合
              svgEl.style.fill = "none";
            }
          }

          if (globalElementIndex === 0) {
            console.log(
              `🖊️ Element ${globalElementIndex}: STROKE ${(strokeProgress * 100).toFixed(
                1
              )}%, FILL ${(fillProgress * 100).toFixed(1)}%, StrokeOpacity ${strokeOpacity.toFixed(
                2
              )}`
            );
          }
        } else {
          // アニメーション完了
          svgEl.style.visibility = "visible";
          svgEl.style.opacity = "1";
          svgEl.style.fill = "";
          svgEl.style.fillOpacity = "";
          svgEl.style.stroke = "";
          svgEl.style.strokeOpacity = "";
          svgEl.style.strokeWidth = "";
          svgEl.style.strokeDasharray = "";
          svgEl.style.strokeDashoffset = "";
        }
        animatedCount++;
      } else {
        // stroke-dasharrayが使えない場合は、文字要素に対して段階的アニメーションを適用
        if (svgEl instanceof SVGUseElement && elementType === "use" && useElementIndex >= 0) {
          // 全要素での統一された順番表示設定を適用
          let elementStartTime = 0;
          let elementDuration = 1;

          if (opts.sequentialChars && totalElements > 1) {
            // 順番表示の場合: 各要素が重複しながらアニメーション
            const overlapRatio = opts.overlapRatio; // オプションから重複率を取得
            const baseElementDuration = 1 / (1 + (totalElements - 1) * (1 - overlapRatio));
            elementDuration = baseElementDuration;
            elementStartTime = globalElementIndex * baseElementDuration * (1 - overlapRatio);
          } else {
            // 同時表示の場合: 全要素が同時にアニメーション
            elementStartTime = 0;
            elementDuration = 1;
          }

          // このキャラクターの終了時刻
          const elementEndTime = elementStartTime + elementDuration;

          // デバッグ: 最初と最後の要素のみログ出力
          if (globalElementIndex === 0 || globalElementIndex === totalElements - 1) {
            console.log(
              `📋 Element ${globalElementIndex}/${totalElements} (${elementType}): sequential=${
                opts.sequentialChars
              }, start=${elementStartTime.toFixed(3)}, duration=${elementDuration.toFixed(
                3
              )}, progress=${progress.toFixed(3)}`
            );
          }

          if (progress < elementStartTime) {
            // まだ開始していない - 完全に非表示
            svgEl.style.visibility = "hidden";
          } else if (progress <= elementEndTime) {
            // このキャラクターのアニメーション中
            svgEl.style.visibility = "visible";
            const elementProgress = (progress - elementStartTime) / elementDuration;

            // 重複2フェーズアニメーション: stroke開始 → fillも重複して開始 → stroke終了=fill終了でstroke非表示
            const strokeDuration = opts.strokeDuration;
            const fillDuration = opts.fillDuration;

            // fillの開始タイミングを調整（strokeが終わるのと同時にfillが完了するように）
            const fillStartTime = strokeDuration - fillDuration;
            const fillPhaseStart = Math.max(0, fillStartTime);

            // デバッグ: 最初の要素のみログ出力
            if (globalElementIndex === 0) {
              console.log(
                `🎭 Element ${globalElementIndex}: elementProgress=${elementProgress.toFixed(
                  3
                )}, strokeDur=${strokeDuration}, fillStart=${fillPhaseStart.toFixed(
                  3
                )}, fillDur=${fillDuration}`
              );
            }

            // fill フェーズ（重複実行）
            let fillProgress = 0;
            if (elementProgress >= fillPhaseStart) {
              fillProgress = Math.min(
                1,
                Math.max(0, (elementProgress - fillPhaseStart) / fillDuration)
              );
            }

            // stroke フェーズ
            const strokeProgress = Math.min(1, Math.max(0, elementProgress / strokeDuration));

            // strokeのフェードアウト（fillの進行に合わせて徐々に薄くする）
            const strokeOpacity = Math.max(0, 1 - fillProgress);

            // アニメーション完了判定
            const isAnimationComplete = elementProgress >= strokeDuration;

            if (isAnimationComplete) {
              // アニメーション完了 - 全てのアニメーションスタイルをリセット
              svgEl.style.visibility = "visible";
              svgEl.style.opacity = "1";
              svgEl.style.fill = "";
              svgEl.style.fillOpacity = "";
              svgEl.style.stroke = "";
              svgEl.style.strokeOpacity = "";
              svgEl.style.strokeWidth = "";
            } else {
              // アニメーション中
              svgEl.style.visibility = "visible";
              svgEl.style.opacity = strokeProgress.toString();

              // strokeのスタイル設定（fillの進行に合わせて徐々にフェード）
              if (strokeOpacity > 0) {
                svgEl.style.stroke = `currentColor`;
                svgEl.style.strokeOpacity = strokeOpacity.toString();
                svgEl.style.strokeWidth = "3";
              } else {
                svgEl.style.stroke = "none";
                svgEl.style.strokeWidth = "0";
              }

              if (fillProgress > 0) {
                // fillが開始されている場合は設定された色で徐々に復元
                svgEl.style.fill = `currentColor`;
                svgEl.style.fillOpacity = fillProgress.toString();
              } else {
                // まだfillが開始されていない場合
                svgEl.style.fill = "none";
              }
            }

            if (globalElementIndex === 0) {
              console.log(
                `🖊️ Element ${globalElementIndex} (USE): STROKE ${(strokeProgress * 100).toFixed(
                  1
                )}%, FILL ${(fillProgress * 100).toFixed(
                  1
                )}%, StrokeOpacity ${strokeOpacity.toFixed(2)}`
              );
            }
          } else {
            // アニメーション完了
            svgEl.style.visibility = "visible";
            svgEl.style.opacity = "1";
            svgEl.style.fill = "";
            svgEl.style.fillOpacity = "";
            svgEl.style.stroke = "";
            svgEl.style.strokeOpacity = "";
            svgEl.style.strokeWidth = "";
          }

          animatedCount++;
        }
      }
    } catch (error) {
      // getTotalLength()などが失敗した場合はスキップ
      if (progress === 0) {
        console.warn(`❌ SVG element animation failed for ${elementType}:`, error);
      }
    }
  });

  // 最終結果は初回のみログ出力
  if (progress === 0 || progress === 1) {
    console.log(`🎉 Animated ${animatedCount}/${totalElements} elements (progress: ${progress})`);
  }

  return clonedElement;
};

export const OverlayRenderer: React.FC<OverlayRendererProps> = ({
  formulas,
  subtitles,
  currentFrame,
  containerWidth,
  containerHeight,
  exportWidth = 1920,
  exportHeight = 1080,
  displayScale = 1,
  displayOffsetX = 0,
  displayOffsetY = 0,
  className = "",
  pixelRatio = window.devicePixelRatio || 2, // デフォルトで高解像度
  debug = import.meta.env.DEV, // 開発環境ではデフォルトでデバッグ有効
  selectedElementId = null,
  selectedElementType = null,
  onFormulaUpdate,
  onSubtitleUpdate,
  onElementSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mathJaxLoaded, setMathJaxLoaded] = useState(false);
  const [renderedElements, setRenderedElements] = useState<{
    formulas: Array<{ element: FormulaElement; html: string; animationState: AnimationState }>;
    subtitles: Array<{ element: SubtitleElement; animationState: AnimationState }>;
  }>({ formulas: [], subtitles: [] });

  // ドラッグ状態の管理
  const [dragState, setDragState] = useState<{
    elementId: string;
    elementType: "formula" | "subtitle";
    isDragging: boolean;
    startX: number;
    startY: number;
    startPosition: { x: number; y: number };
    offsetX: number; // 要素左上角からマウス位置へのオフセット
    offsetY: number; // 要素左上角からマウス位置へのオフセット
  } | null>(null);

  // リサイズ状態の管理
  const [resizeState, setResizeState] = useState<{
    elementId: string;
    elementType: "formula" | "subtitle";
    isResizing: boolean;
    startX: number;
    startY: number;
    startScale: number;
  } | null>(null);

  // MathJax初期化（改良版）
  useEffect(() => {
    const initMathJax = () => {
      if (typeof window !== "undefined" && !window.MathJax) {
        if (debug) {
          console.log("Initializing MathJax...");
        }

        // MathJaxの設定（SVG出力最適化）
        if (!window.MathJax) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).MathJax = {
            tex: {
              inlineMath: [
                ["$", "$"],
                ["\\(", "\\)"],
              ],
              displayMath: [
                ["$$", "$$"],
                ["\\[", "\\]"],
              ],
              processEscapes: true,
              processEnvironments: true,
            },
            svg: {
              fontCache: "none",
            },
          };
        }

        // MathJaxスクリプトを動的に読み込み
        const mathJaxScript = document.createElement("script");
        mathJaxScript.src = "https://cdn.jsdelivr.net/npm/mathjax@4/tex-svg.js";
        mathJaxScript.async = true;
        mathJaxScript.defer = true;
        mathJaxScript.onload = () => {
          if (debug) {
            console.log("MathJax script loaded");
          }
          setTimeout(() => {
            setMathJaxLoaded(true);
            if (debug) {
              console.log("MathJax loaded state set to true");
            }
          }, 200); // タイムアウトを少し延長
        };
        mathJaxScript.onerror = (error) => {
          console.error("Failed to load MathJax script:", error);
        };
        document.head.appendChild(mathJaxScript);
      } else if (window.MathJax) {
        if (debug) {
          console.log("MathJax already exists, setting loaded state");
        }
        setMathJaxLoaded(true);
      }
    };

    initMathJax();
  }, [debug]);

  // 数式をHTMLに変換（SVG優先、描画アニメーション対応）
  const renderMathToHTML = useCallback(
    async (latex: string, fontSize: number, forDrawAnimation = false): Promise<string> => {
      if (!window.MathJax || !mathJaxLoaded) {
        if (debug) {
          console.log("MathJax not ready, returning fallback for:", latex);
        }
        return `<span style="color: red;">${latex}</span>`; // デバッグ用に赤色で表示
      }

      try {
        if (debug) {
          console.log("Rendering LaTeX:", latex);
        }

        // LaTeX構文の前処理（適切な数学モードで囲む）
        const processedLatex = latex.trim();

        if (debug) {
          console.log("Processed LaTeX:", processedLatex);
        }

        // SVGレンダリングを試行
        if (window.MathJax.tex2svg) {
          const svgNode = window.MathJax.tex2svg(processedLatex, {
            display: true,
          });
          if (svgNode) {
            if (debug) {
              console.log("Successfully rendered with tex2svg");
            }

            // プレビュー用のex/em単位をpx単位に強制変換（displayScaleを適用）
            let svgHTML = svgNode.outerHTML;

            // スケールファクターを計算（プレビューではdisplayScaleを適用）
            const baseFontSize = fontSize * displayScale; // プレビュー用のベースフォントサイズ（displayScaleを適用）

            // SVGのwidth/height属性をピクセル単位に強制変換
            svgHTML = svgHTML.replace(
              /width="([0-9.]+)(ex|em)"/g,
              (match: string, value: string, unit: string) => {
                const numValue = parseFloat(value);
                const pixelValue =
                  unit === "ex" ? numValue * (baseFontSize * 0.5) : numValue * baseFontSize;
                if (debug) {
                  console.log(
                    `Converting preview SVG width: width="${value}${unit}" -> width="${pixelValue}px" (displayScale=${displayScale})`
                  );
                }
                return `width="${pixelValue}px"`;
              }
            );

            svgHTML = svgHTML.replace(
              /height="([0-9.]+)(ex|em)"/g,
              (match: string, value: string, unit: string) => {
                const numValue = parseFloat(value);
                const pixelValue =
                  unit === "ex" ? numValue * (baseFontSize * 0.5) : numValue * baseFontSize;
                if (debug) {
                  console.log(
                    `Converting preview SVG height: height="${value}${unit}" -> height="${pixelValue}px" (displayScale=${displayScale})`
                  );
                }
                return `height="${pixelValue}px"`;
              }
            );

            // mjx-containerのスタイルも調整（必要に応じて）
            svgHTML = svgHTML.replace(
              /<mjx-container([^>]*)>/g,
              (match: string, attributes: string) => {
                let updatedAttributes = attributes;

                // widthやheightがstyle属性に含まれている場合も変換
                updatedAttributes = updatedAttributes.replace(
                  /style="([^"]*)"/g,
                  (_styleMatch: string, styleContent: string) => {
                    let updatedStyleContent = styleContent;

                    // style内のwidth/height変換（displayScaleを適用）
                    updatedStyleContent = updatedStyleContent.replace(
                      /width:\s*([0-9.]+)(ex|em)/g,
                      (_cssMatch: string, value: string, unit: string) => {
                        const numValue = parseFloat(value);
                        const pixelValue =
                          unit === "ex" ? numValue * (baseFontSize * 0.5) : numValue * baseFontSize;
                        if (debug) {
                          console.log(
                            `Converting preview CSS width: width: ${value}${unit} -> width: ${pixelValue}px (displayScale=${displayScale})`
                          );
                        }
                        return `width: ${pixelValue}px`;
                      }
                    );

                    updatedStyleContent = updatedStyleContent.replace(
                      /height:\s*([0-9.]+)(ex|em)/g,
                      (_cssMatch: string, value: string, unit: string) => {
                        const numValue = parseFloat(value);
                        const pixelValue =
                          unit === "ex" ? numValue * (baseFontSize * 0.5) : numValue * baseFontSize;
                        if (debug) {
                          console.log(
                            `Converting preview CSS height: height: ${value}${unit} -> height: ${pixelValue}px (displayScale=${displayScale})`
                          );
                        }
                        return `height: ${pixelValue}px`;
                      }
                    );

                    return `style="${updatedStyleContent}"`;
                  }
                );

                return `<mjx-container${updatedAttributes}>`;
              }
            );

            return svgHTML;
          }
        }

        if (debug) {
          console.warn("No MathJax rendering method available");
        }
        return `<span style="color: orange;">${latex}</span>`;
      } catch (error) {
        console.error("MathJax rendering failed:", error);
        return `<span style="color: red;">Error: ${latex}</span>`;
      }
    },
    [mathJaxLoaded, debug, displayScale]
  );

  // 要素の更新処理
  useEffect(() => {
    if (debug) {
      console.log("Update elements effect triggered:", {
        formulasCount: formulas.length,
        subtitlesCount: subtitles.length,
        currentFrame,
        mathJaxLoaded,
      });
    }

    const updateElements = async () => {
      if (debug) {
        console.log("Starting element update...");
      }

      const newFormulas = await Promise.all(
        formulas.map(async (formula, index) => {
          const animationState = calculateAnimationProgress(formula, currentFrame);
          if (debug) {
            console.log(`Formula ${index} animation state:`, animationState);
          }

          const html = await renderMathToHTML(
            formula.content,
            formula.style.fontSize,
            formula.animation?.type === "draw"
          );
          if (debug) {
            console.log(`Formula ${index} rendered HTML:`, html.substring(0, 100) + "...");
          }

          return { element: formula, html, animationState };
        })
      );

      const newSubtitles = subtitles.map((subtitle, index) => {
        const animationState = calculateAnimationProgress(subtitle, currentFrame);
        if (debug) {
          console.log(`Subtitle ${index} animation state:`, animationState);
        }
        return { element: subtitle, animationState };
      });

      if (debug) {
        console.log("Setting rendered elements:", {
          formulasCount: newFormulas.length,
          subtitlesCount: newSubtitles.length,
        });
      }

      setRenderedElements({ formulas: newFormulas, subtitles: newSubtitles });
    };

    updateElements();
  }, [formulas, subtitles, currentFrame, mathJaxLoaded, renderMathToHTML, debug]);

  // 画面座標から数式の相対座標への変換（数式も0-1の範囲で扱う）
  const screenToFormulaRelative = useCallback(
    (screenX: number, screenY: number) => {
      // 表示座標からエクスポート座標に変換
      const exportX = (screenX - displayOffsetX) / displayScale;
      const exportY = (screenY - displayOffsetY) / displayScale;

      // エクスポート座標から相対座標(0-1)に変換
      const relativeX = exportX / exportWidth;
      const relativeY = exportY / exportHeight;

      return { x: relativeX, y: relativeY };
    },
    [displayScale, displayOffsetX, displayOffsetY, exportWidth, exportHeight]
  );

  // 画面座標から字幕の相対座標への変換
  const screenToSubtitleRelative = useCallback(
    (screenX: number, screenY: number) => {
      // 表示座標からエクスポート座標に変換
      const exportX = (screenX - displayOffsetX) / displayScale;
      const exportY = (screenY - displayOffsetY) / displayScale;

      // エクスポート座標から相対座標(0-1)に変換
      const relativeX = exportX / exportWidth;
      const relativeY = exportY / exportHeight;

      return { x: relativeX, y: relativeY };
    },
    [displayScale, displayOffsetX, displayOffsetY, exportWidth, exportHeight]
  );

  // ドラッグ開始
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string, elementType: "formula" | "subtitle") => {
      e.preventDefault();
      e.stopPropagation();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      // 要素を選択
      onElementSelect?.(elementId, elementType);

      // 現在の位置を取得
      const element =
        elementType === "formula"
          ? formulas.find((f) => f.id === elementId)
          : subtitles.find((s) => s.id === elementId);

      if (!element) return;

      // 要素の現在の画面座標を取得（数式も字幕も同じく0-1の相対座標として扱う）
      const exportScreenX = element.position.x * exportWidth;
      const exportScreenY = element.position.y * exportHeight;
      const elementScreenX = exportScreenX * displayScale + displayOffsetX;
      const elementScreenY = exportScreenY * displayScale + displayOffsetY;

      // マウス位置と要素位置の差分（オフセット）を計算
      const offsetX = startX - elementScreenX;
      const offsetY = startY - elementScreenY;

      setDragState({
        elementId,
        elementType,
        isDragging: false,
        startX,
        startY,
        startPosition: { x: element.position.x, y: element.position.y },
        offsetX,
        offsetY,
      });
    },
    [
      onElementSelect,
      formulas,
      subtitles,
      exportWidth,
      exportHeight,
      displayScale,
      displayOffsetX,
      displayOffsetY,
    ]
  );

  // リサイズ開始
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string, elementType: "formula" | "subtitle") => {
      e.preventDefault();
      e.stopPropagation();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      // 現在のスケールを取得
      const element =
        elementType === "formula"
          ? formulas.find((f) => f.id === elementId)
          : subtitles.find((s) => s.id === elementId);

      if (!element) return;

      const startScale =
        elementType === "formula"
          ? (element as FormulaElement).style.fontSize / 16 // 数式もフォントサイズベースに変更
          : (element as SubtitleElement).style.fontSize / 16; // 基準フォントサイズを16pxとして正規化

      setResizeState({
        elementId,
        elementType,
        isResizing: false,
        startX,
        startY,
        startScale,
      });
    },
    [formulas, subtitles]
  );

  // マウス移動ハンドラー
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      if (dragState) {
        const deltaX = currentX - dragState.startX;
        const deltaY = currentY - dragState.startY;

        if (!dragState.isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
          setDragState((prev) => (prev ? { ...prev, isDragging: true } : null));
        }

        if (dragState.isDragging) {
          if (dragState.elementType === "formula" && onFormulaUpdate) {
            // オフセットを考慮して正しい位置を計算
            const targetScreenX = currentX - dragState.offsetX;
            const targetScreenY = currentY - dragState.offsetY;
            const newRelativePos = screenToFormulaRelative(targetScreenX, targetScreenY);
            onFormulaUpdate(dragState.elementId, {
              position: newRelativePos,
            });
          } else if (dragState.elementType === "subtitle" && onSubtitleUpdate) {
            // オフセットを考慮して正しい位置を計算
            const targetScreenX = currentX - dragState.offsetX;
            const targetScreenY = currentY - dragState.offsetY;
            const newRelativePos = screenToSubtitleRelative(targetScreenX, targetScreenY);
            onSubtitleUpdate(dragState.elementId, {
              position: newRelativePos,
            });
          }
        }
      }

      if (resizeState) {
        const deltaY = currentY - resizeState.startY;

        if (!resizeState.isResizing && Math.abs(deltaY) > 5) {
          setResizeState((prev) => (prev ? { ...prev, isResizing: true } : null));
        }

        if (resizeState.isResizing) {
          // Y方向の移動量に基づいてスケールを調整
          const scaleFactor = 1 + deltaY / 100; // 100px移動で2倍
          const newScale = Math.max(0.1, resizeState.startScale * scaleFactor);

          if (resizeState.elementType === "formula" && onFormulaUpdate) {
            const currentFormula = formulas.find((f) => f.id === resizeState.elementId);
            if (currentFormula) {
              const newFontSize = Math.max(8, newScale * 16); // 数式もフォントサイズで制御
              onFormulaUpdate(resizeState.elementId, {
                style: { ...currentFormula.style, fontSize: newFontSize },
              });
            }
          } else if (resizeState.elementType === "subtitle" && onSubtitleUpdate) {
            const currentSubtitle = subtitles.find((s) => s.id === resizeState.elementId);
            if (currentSubtitle) {
              const newFontSize = Math.max(8, newScale * 16); // 基準16pxから計算
              onSubtitleUpdate(resizeState.elementId, {
                style: { ...currentSubtitle.style, fontSize: newFontSize },
              });
            }
          }
        }
      }
    },
    [
      dragState,
      resizeState,
      screenToFormulaRelative,
      screenToSubtitleRelative,
      onFormulaUpdate,
      onSubtitleUpdate,
      formulas,
      subtitles,
    ]
  );

  // マウスアップハンドラー
  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setResizeState(null);
  }, []);

  // マウスイベントリスナーの管理
  useEffect(() => {
    if (dragState || resizeState) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, resizeState, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full z-10 overflow-hidden pointer-events-auto ${className} ${
        debug ? "border-2 border-red-500/50" : ""
      }`}
      onClick={(e) => {
        // 背景クリックで選択解除
        if (e.target === e.currentTarget) {
          onElementSelect?.(null, null);
        }
      }}
    >
      {/* デバッグ情報表示 */}
      {debug && (
        <div className="absolute top-2 left-2 bg-black/80 text-white p-2 text-xs z-[100] pointer-events-auto rounded">
          Debug: F:{renderedElements.formulas.length} S:{renderedElements.subtitles.length} Frame:
          {currentFrame} MJ:{mathJaxLoaded ? "✓" : "✗"}
          <br />
          Export: {exportWidth}x{exportHeight} Scale: {displayScale.toFixed(3)}
          <br />
          Container: {containerWidth}x{containerHeight}
        </div>
      )}

      {/* 数式レンダリング */}
      {renderedElements.formulas.map(({ element, html, animationState }, index) => {
        if (debug) {
          console.log(`Rendering formula ${index}:`, {
            visible: animationState.visible,
            element: element.id,
            progress: animationState.progress,
          });
        }

        if (!animationState.visible) {
          if (debug) {
            console.log(`Formula ${index} not visible (animationState.visible = false)`);
          }
          return null;
        }

        // 数式の座標計算（0-1の相対座標をピクセル座標に変換）
        const exportScreenX = element.position.x * exportWidth;
        const exportScreenY = element.position.y * exportHeight;
        const screenX = exportScreenX * displayScale + displayOffsetX;
        const screenY = exportScreenY * displayScale + displayOffsetY;

        if (debug) {
          console.log(`Formula ${index} screen position:`, { screenX, screenY });
        }

        // アニメーション効果の計算
        let opacity = element.style.opacity * animationState.progress;
        let translateX = 0;
        let fontSize = element.style.fontSize; // フォントサイズベースに変更
        let transform = "";

        // 出現アニメーション
        switch (element.animation?.type) {
          case "fade":
            opacity =
              element.style.opacity * (animationState.enterProgress || animationState.progress);
            break;
          case "scale":
            fontSize =
              element.style.fontSize * (animationState.enterProgress || animationState.progress);
            break;
          case "slide":
            translateX = (1 - (animationState.enterProgress || animationState.progress)) * -50;
            break;
          case "draw":
            // 描画アニメーションは後でHTMLコンテンツに適用
            opacity = element.style.opacity;
            break;
        }

        // 消去アニメーション
        if (
          element.exitAnimation &&
          element.exitAnimation.type !== "none" &&
          animationState.exitProgress &&
          animationState.exitProgress > 0
        ) {
          switch (element.exitAnimation.type) {
            case "fade":
              opacity = opacity * (1 - animationState.exitProgress);
              break;
            case "scale":
              fontSize = fontSize * (1 - animationState.exitProgress);
              break;
            case "slide":
              translateX = translateX + animationState.exitProgress * 50;
              break;
          }
        }

        transform = `translate(${screenX + translateX}px, ${screenY}px) ${
          element.style.rotation ? `rotate(${element.style.rotation}deg)` : ""
        }`;

        const isSelected = selectedElementId === element.id && selectedElementType === "formula";

        return (
          <div
            key={`formula-${element.id}-${index}`}
            className={`formula-overlay-element absolute left-0 top-0 flex items-center justify-center min-h-4 cursor-move pointer-events-auto z-20 transition-shadow duration-200 ${
              debug ? "border border-red-500" : ""
            }`}
            style={{
              transform,
              transformOrigin: "center center",
              opacity,
              fontSize: `${fontSize * displayScale}px`, // 計算されたfontSizeを使用
              color: element.style.color,
              backgroundColor: debug
                ? element.style.backgroundColor || "rgba(255, 255, 0, 0.3)"
                : element.style.backgroundColor || "transparent",
              padding: element.style.backgroundColor || debug ? "8px" : "0",
              borderRadius: element.style.backgroundColor || debug ? "4px" : "0",
              boxShadow: isSelected ? "0 0 0 2px #007bff" : "none",
              // MathJaxのスタイルを確実に適用するためのCSS
              fontFamily: "inherit",
              lineHeight: "1.2",
              textAlign: "center",
              // 高品質レンダリングのためのCSS
              WebkitFontSmoothing: "antialiased",
              fontSmooth: "always",
              textRendering: "optimizeLegibility",
            }}
            onMouseDown={(e) => handleMouseDown(e, element.id, "formula")}
          >
            <div
              style={{
                fontSize: "inherit",
                color: "inherit",
                lineHeight: "1",
                textAlign: "center",
              }}
              dangerouslySetInnerHTML={{
                __html:
                  element.animation?.type === "draw"
                    ? (() => {
                        // 描画アニメーション用のHTMLを生成
                        const progress = animationState.enterProgress || animationState.progress;
                        if (debug) {
                          console.log(`Draw animation progress for ${element.id}: ${progress}`);
                        }

                        const tempDiv = document.createElement("div");
                        tempDiv.innerHTML = html;

                        // drawアニメーションのオプションを取得
                        const drawOptions =
                          element.animation?.type === "draw"
                            ? element.animation.drawOptions
                            : undefined;

                        // デバッグ: オプションが正しく渡されているかチェック
                        if (progress === 0) {
                          console.log(`🔧 Draw animation for ${element.id}:`, drawOptions);
                        }

                        const processedElement = applySVGDrawAnimation(
                          tempDiv,
                          progress,
                          drawOptions,
                          element.style.color // 色を渡す
                        );

                        if (debug && progress === 0) {
                          console.log(
                            `Draw animation processed HTML for ${element.id}:`,
                            processedElement.innerHTML.substring(0, 200) + "..."
                          );
                        }

                        return processedElement.innerHTML;
                      })()
                    : html,
              }}
            />

            {/* 選択時のコントロール */}
            {isSelected && (
              <>
                {/* リサイズハンドル */}
                <div
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize z-30"
                  onMouseDown={(e) => handleResizeMouseDown(e, element.id, "formula")}
                />
              </>
            )}
          </div>
        );
      })}

      {/* 字幕レンダリング */}
      {renderedElements.subtitles.map(({ element, animationState }, index) => {
        if (debug) {
          console.log(`Rendering subtitle ${index}:`, {
            visible: animationState.visible,
            element: element.id,
            progress: animationState.progress,
          });
        }

        if (!animationState.visible) {
          if (debug) {
            console.log(`Subtitle ${index} not visible`);
          }
          return null;
        }

        // 字幕の座標計算（エクスポート解像度基準）
        const exportScreenX = element.position.x * exportWidth;
        const exportScreenY = element.position.y * exportHeight;

        // 実際の表示サイズにスケール＆オフセット適用
        const screenX = exportScreenX * displayScale + displayOffsetX;
        const screenY = exportScreenY * displayScale + displayOffsetY;

        let displayText = element.text;
        let opacity = element.style.opacity;
        let translateX = 0;

        // 出現アニメーション
        switch (element.animation?.type) {
          case "typewriter":
            displayText = getTypewriterText(
              element.text,
              animationState.enterProgress || animationState.progress
            );
            opacity = element.style.opacity;
            break;
          case "fade":
            opacity =
              element.style.opacity * (animationState.enterProgress || animationState.progress);
            break;
          case "slide":
            translateX = (1 - (animationState.enterProgress || animationState.progress)) * -100;
            break;
        }

        // 消去アニメーション
        if (
          element.exitAnimation &&
          element.exitAnimation.type !== "none" &&
          animationState.exitProgress &&
          animationState.exitProgress > 0
        ) {
          switch (element.exitAnimation.type) {
            case "fade":
              opacity = opacity * (1 - animationState.exitProgress);
              break;
            case "slide":
              translateX = translateX + animationState.exitProgress * 100;
              break;
          }
        }

        const transform = `translate(${screenX + translateX}px, ${screenY}px)`;
        const isSelected = selectedElementId === element.id && selectedElementType === "subtitle";

        return (
          <div
            key={`subtitle-${element.id}-${index}`}
            className={`absolute left-0 top-0 cursor-move pointer-events-auto z-20 whitespace-pre-wrap transition-shadow duration-200 ${
              debug ? "border border-blue-500" : ""
            }`}
            style={{
              transform,
              transformOrigin: "center center",
              opacity,
              fontSize: `${element.style.fontSize * displayScale}px`,
              color: element.style.color,
              backgroundColor: debug
                ? element.style.backgroundColor || "rgba(0, 255, 255, 0.3)"
                : element.style.backgroundColor || "transparent",
              padding: element.style.backgroundColor || debug ? "12px" : "0",
              borderRadius: element.style.backgroundColor || debug ? "8px" : "0",
              boxShadow: isSelected ? "0 0 0 2px #28a745" : "none",
              fontFamily: element.style.fontFamily || "Arial",
              fontWeight: element.style.fontWeight || "normal",
              textAlign: element.style.textAlign || "center",
              // 高品質レンダリングのためのCSS
              WebkitFontSmoothing: "antialiased",
              fontSmooth: "always",
              textRendering: "optimizeLegibility",
            }}
            onMouseDown={(e) => handleMouseDown(e, element.id, "subtitle")}
          >
            {displayText}

            {/* 選択時のコントロール */}
            {isSelected && (
              <>
                {/* リサイズハンドル */}
                <div
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-green-500 border-2 border-white rounded-full cursor-nw-resize z-30"
                  onMouseDown={(e) => handleResizeMouseDown(e, element.id, "subtitle")}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 静的描画用のヘルパー関数（VideoExportPanel用）
// eslint-disable-next-line react-refresh/only-export-components
export const renderOverlayToCanvas = async (
  canvas: HTMLCanvasElement,
  formulas: FormulaElement[],
  subtitles: SubtitleElement[],
  currentFrame: number,
  exportWidth: number,
  exportHeight: number
): Promise<void> => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 数式をHTMLに変換する関数（OverlayRendererから移植）
  const renderMathToHTML = async (
    latex: string,
    fontSize: number,
    color: string,
    exportScale: number = 1 // プレビューとの一致のためのスケール
  ): Promise<string> => {
    // MathJaxが利用可能か、より詳細にチェック
    console.log("MathJax Check:", {
      windowMathJax: !!window.MathJax,
      tex2svg: !!(window.MathJax && window.MathJax.tex2svg),
      startup: !!(window.MathJax && window.MathJax.startup),
    });

    if (!window.MathJax || !window.MathJax.tex2svg) {
      console.warn("MathJax not available, using fallback");
      return `<span style="color: ${color}; font-size: ${
        fontSize * exportScale
      }px;">${latex}</span>`;
    }

    try {
      const processedLatex = latex.trim();
      // プレビューと同じスケーリングを適用
      const scaledFontSize = fontSize * exportScale;
      console.log(
        `Attempting to render: ${processedLatex} with scaledFontSize: ${scaledFontSize}px (original: ${fontSize}px, scale: ${exportScale})`
      );

      // ドキュメントに基づいた正確なオプション設定
      const options = {
        display: true,
      };

      console.log("MathJax options:", options);

      const svgNode = window.MathJax.tex2svg(processedLatex, options);

      console.log("MathJax result:", svgNode);

      if (svgNode) {
        // 最初の子がHTMLElementの場合のみスタイルを設定
        const firstChild = svgNode.firstChild;
        if (firstChild && firstChild instanceof HTMLElement) {
          firstChild.style.setProperty("font-size", `${scaledFontSize}px`);
        }
        let svgHTML = svgNode.outerHTML;

        // スタンドアロンSVG作成のためのCSS定義（ドキュメント推奨 + 色指定）
        const svgCss = [
          // 色指定
          `g[data-mml-node] {fill: ${color} !important;}`,
          `text {fill: ${color} !important;}`,
          `path {fill: ${color} !important;}`,
          `rect {fill: ${color} !important;}`,
          `use {fill: ${color} !important;}`,
          // currentColor の上書き
          `*[fill="currentColor"] {fill: ${color} !important;}`,
        ].join("");

        // スタンドアロンSVGとして必要なスタイルを埋め込み
        svgHTML = svgHTML.match(/^<svg.*?><defs>/)
          ? svgHTML.replace(/<defs>/, `<defs><style>${svgCss}</style>`)
          : svgHTML.replace(/^(<svg.*?>)/, `$1<defs><style>${svgCss}</style></defs>`);

        // 不要な属性を削除してクリーンアップ
        svgHTML = svgHTML
          .replace(/ (?:role|focusable|aria-hidden)=".*?"/g, "")
          .replace(/"currentColor"/g, `"${color}"`);

        // SVGのサイズを確実にピクセル単位に変換
        // mjx-container内のSVGのex/em単位をピクセル単位に強制変換
        svgHTML = svgHTML.replace(
          /width="([0-9.]+)(ex|em)"/g,
          (match: string, value: string, unit: string) => {
            const numValue = parseFloat(value);
            const pixelValue =
              unit === "ex" ? numValue * (scaledFontSize * 0.5) : numValue * scaledFontSize;
            console.log(
              `Converting width: ${match} -> width="${pixelValue}px" (scaledFontSize: ${scaledFontSize})`
            );
            return `width="${pixelValue}px"`;
          }
        );

        svgHTML = svgHTML.replace(
          /height="([0-9.]+)(ex|em)"/g,
          (match: string, value: string, unit: string) => {
            const numValue = parseFloat(value);
            const pixelValue =
              unit === "ex" ? numValue * (scaledFontSize * 0.5) : numValue * scaledFontSize;
            console.log(
              `Converting height: ${match} -> height="${pixelValue}px" (scaledFontSize: ${scaledFontSize})`
            );
            return `height="${pixelValue}px"`;
          }
        );

        // mjx-containerのスタイルも調整（必要に応じて）
        svgHTML = svgHTML.replace(
          /<mjx-container([^>]*)>/g,
          (match: string, attributes: string) => {
            // mjx-containerのスタイルがあればピクセル単位に変換
            let updatedAttributes = attributes;

            // data-mjx-texclass など他の属性はそのまま保持
            // widthやheightがstyle属性に含まれている場合も変換
            updatedAttributes = updatedAttributes.replace(
              /style="([^"]*)"/g,
              (_styleMatch: string, styleContent: string) => {
                let updatedStyleContent = styleContent;

                // style内のwidth/height変換
                updatedStyleContent = updatedStyleContent.replace(
                  /width:\s*([0-9.]+)(ex|em)/g,
                  (_cssMatch: string, value: string, unit: string) => {
                    const numValue = parseFloat(value);
                    const pixelValue =
                      unit === "ex" ? numValue * (scaledFontSize * 0.5) : numValue * scaledFontSize;
                    console.log(
                      `Converting CSS width: width: ${value}${unit} -> width: ${pixelValue}px`
                    );
                    return `width: ${pixelValue}px`;
                  }
                );

                updatedStyleContent = updatedStyleContent.replace(
                  /height:\s*([0-9.]+)(ex|em)/g,
                  (_cssMatch: string, value: string, unit: string) => {
                    const numValue = parseFloat(value);
                    const pixelValue =
                      unit === "ex" ? numValue * (scaledFontSize * 0.5) : numValue * scaledFontSize;
                    console.log(
                      `Converting CSS height: height: ${value}${unit} -> height: ${pixelValue}px`
                    );
                    return `height: ${pixelValue}px`;
                  }
                );

                return `style="${updatedStyleContent}"`;
              }
            );

            return `<mjx-container${updatedAttributes}>`;
          }
        );

        console.log(
          `Enhanced SVG with scaledFontSize=${scaledFontSize}px, color=${color}:`,
          svgHTML.substring(0, 300)
        );
        return svgHTML;
      } else {
        return `<span style="color: ${color}; font-size: ${fontSize}px;">${latex}</span>`;
      }
    } catch (error) {
      console.error("MathJax rendering failed:", error);
      return `<span style="color: ${color}; font-size: ${fontSize}px;">Error: ${latex}</span>`;
    }
  };

  // 数式を描画
  console.log(
    `🎨 renderOverlayToCanvas: processing ${formulas.length} formulas for frame ${currentFrame}`
  );
  for (const formula of formulas) {
    console.log(`🧮 Processing formula:`, formula);
    const animationState = calculateAnimationProgress(formula, currentFrame);
    console.log(`🧮 Animation state:`, animationState);
    if (!animationState.visible) {
      console.log(`🧮 Formula not visible, skipping`);
      continue;
    }

    const screenX = formula.position.x * exportWidth;
    const screenY = formula.position.y * exportHeight;
    console.log(`🧮 Screen position: ${screenX}, ${screenY}`);

    try {
      // 数式をHTMLに変換
      const html = await renderMathToHTML(
        formula.content,
        formula.style.fontSize,
        formula.style.color
      );
      console.log(`🧮 Rendered HTML:`, html);

      // HTMLを一時的なDIVに描画してcanvasに変換
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.fontSize = `${formula.style.fontSize}px`;
      tempDiv.style.color = formula.style.color;
      tempDiv.style.fontFamily = "inherit";
      tempDiv.style.lineHeight = "1.2";
      tempDiv.style.textAlign = "center";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tempDiv.style as any).webkitFontSmoothing = "antialiased";
      tempDiv.style.textRendering = "optimizeLegibility";

      console.log(`🎨 SVG with embedded styles ready for canvas rendering: ${tempDiv.outerHTML}`);
      document.body.appendChild(tempDiv);

      // SVGをcanvasに描画
      const svgElement = tempDiv.querySelector("svg");
      if (svgElement) {
        // 描画アニメーションを適用
        let processedSvg = svgElement;
        if (formula.animation?.type === "draw") {
          const progress = animationState.enterProgress || animationState.progress;
          const drawOptions = formula.animation.drawOptions;
          const processedElement = applySVGDrawAnimation(
            tempDiv,
            progress,
            drawOptions,
            formula.style.color // 色を渡す
          );
          const newSvgElement = processedElement.querySelector("svg");
          if (newSvgElement) {
            processedSvg = newSvgElement;
          }
        }

        const svgData = new XMLSerializer().serializeToString(processedSvg);
        console.log(`🎨 Serialized SVG data (first 200 chars):`, svgData.substring(0, 200));

        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);

        try {
          console.log(`🎨 Creating image from SVG URL...`);
          const svgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              console.log(`✅ SVG image loaded: ${img.width}x${img.height}`);
              resolve(img);
            };
            img.onerror = (error) => {
              console.error(`❌ SVG image load failed:`, error);
              reject(error);
            };
            img.src = svgUrl;
          });

          ctx.drawImage(svgImg, screenX, screenY);

          URL.revokeObjectURL(svgUrl);
          console.log(`✅ Successfully rendered formula SVG at (${screenX}, ${screenY})`);
        } catch (error) {
          console.warn("Failed to render formula SVG:", error);
        }
      } else {
        // SVGが見つからない場合はCanvas上に直接テキストを描画
        console.log("No SVG found, drawing text directly to canvas");
        ctx.save();
        ctx.fillStyle = formula.style.color;
        ctx.font = `${formula.style.fontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(formula.content, screenX, screenY);
        ctx.restore();
        console.log(
          `✅ Rendered formula as text at (${screenX}, ${screenY}): "${formula.content}"`
        );
      }

      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error("Error rendering formula:", error);
    }
  }

  // 字幕を描画
  for (const subtitle of subtitles) {
    const animationState = calculateAnimationProgress(subtitle, currentFrame);
    if (!animationState.visible) continue;

    const screenX = subtitle.position.x * exportWidth;
    const screenY = subtitle.position.y * exportHeight;

    let displayText = subtitle.text;
    let opacity = subtitle.style.opacity;

    // アニメーション効果
    switch (subtitle.animation?.type) {
      case "typewriter":
        displayText = getTypewriterText(
          subtitle.text,
          animationState.enterProgress || animationState.progress
        );
        break;
      case "fade":
        opacity =
          subtitle.style.opacity * (animationState.enterProgress || animationState.progress);
        break;
    }

    // 文字描画
    ctx.globalAlpha = opacity * animationState.progress;
    ctx.fillStyle = subtitle.style.color;
    ctx.font = `${subtitle.style.fontWeight || "normal"} ${subtitle.style.fontSize}px ${
      subtitle.style.fontFamily || "Arial"
    }`;
    ctx.textAlign = (subtitle.style.textAlign as CanvasTextAlign) || "center";
    ctx.fillText(displayText, screenX, screenY);
    ctx.globalAlpha = 1;
  }
};
