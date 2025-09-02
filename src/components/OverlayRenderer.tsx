import React, { useRef, useEffect, useState, useCallback } from "react";
import type { FormulaElement, SubtitleElement, AnimationState } from "../types/formula";

// MathJax型定義（v4対応）
declare global {
  interface Window {
    MathJax?: {
      tex?: {
        inlineMath: string[][];
        displayMath: string[][];
        processEscapes: boolean;
        processEnvironments: boolean;
        packages?: string[];
        formatError?: (jax: unknown, error: unknown) => unknown;
      };
      options?: {
        processHtmlClass?: string;
        processScriptType?: string;
        skipHtmlTags?: string[];
        ignoreHtmlClass?: string;
      };
      chtml?: {
        scale?: number;
        minScale?: number;
        matchFontHeight?: boolean;
        fontURL?: string;
      };
      svg?: {
        fontCache?: string;
      };
      startup?: {
        defaultReady: () => void;
        ready?: () => void;
      };
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      tex2svg?: (latex: string, options?: Record<string, unknown>) => HTMLElement;
      tex2chtml?: (latex: string, options?: Record<string, unknown>) => HTMLElement;
      tex2chtmlPromise?: (latex: string, options?: Record<string, unknown>) => Promise<HTMLElement>;
      mathml2chtmlPromise?: (
        mathml: string,
        options?: Record<string, unknown>
      ) => Promise<HTMLElement>;
      // MathJax v4の新しいAPI
      document?: {
        convert: (input: string, options?: Record<string, unknown>) => HTMLElement;
      };
    };
  }
}

interface OverlayRendererProps {
  formulas: FormulaElement[];
  subtitles: SubtitleElement[];
  currentFrame: number;
  graphBounds?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
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
}

// アニメーション計算ヘルパー
const calculateAnimationProgress = (
  element: FormulaElement | SubtitleElement,
  currentFrame: number
): AnimationState => {
  const startFrame = element.frame;
  const animation = element.animation;

  if (!animation || animation.type === "none") {
    return {
      frame: currentFrame,
      progress: currentFrame >= startFrame ? 1 : 0,
      visible: currentFrame >= startFrame && element.visible,
    };
  }

  const animationStartFrame = startFrame + (animation.delay || 0);
  const animationEndFrame = animationStartFrame + animation.duration;

  if (currentFrame < animationStartFrame) {
    return {
      frame: currentFrame,
      progress: 0,
      visible: false,
    };
  }

  if (currentFrame >= animationEndFrame) {
    return {
      frame: currentFrame,
      progress: 1,
      visible: element.visible,
    };
  }

  // アニメーション中
  const rawProgress = (currentFrame - animationStartFrame) / animation.duration;

  // イージング適用
  let progress = rawProgress;
  switch (animation.easing) {
    case "ease-in":
      progress = rawProgress * rawProgress;
      break;
    case "ease-out":
      progress = 1 - Math.pow(1 - rawProgress, 2);
      break;
    case "ease-in-out":
      progress =
        rawProgress < 0.5
          ? 2 * rawProgress * rawProgress
          : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;
      break;
    default:
      progress = rawProgress;
  }

  return {
    frame: currentFrame,
    progress: Math.max(0, Math.min(1, progress)),
    visible: element.visible,
  };
};

// 座標変換：グラフ座標 → 画面座標（エクスポート解像度基準）
const graphToScreen = (
  graphX: number,
  graphY: number,
  graphBounds: { left: number; right: number; top: number; bottom: number },
  exportWidth: number,
  exportHeight: number,
  displayScale: number,
  displayOffsetX: number,
  displayOffsetY: number
) => {
  // エクスポート解像度での座標を計算
  const exportScreenX =
    ((graphX - graphBounds.left) / (graphBounds.right - graphBounds.left)) * exportWidth;
  const exportScreenY =
    ((graphBounds.top - graphY) / (graphBounds.top - graphBounds.bottom)) * exportHeight;

  // 実際の表示サイズにスケール＆オフセット適用
  const displayX = exportScreenX * displayScale + displayOffsetX;
  const displayY = exportScreenY * displayScale + displayOffsetY;

  return { x: displayX, y: displayY };
};

// タイプライターアニメーション用のテキスト分割
const getTypewriterText = (text: string, progress: number): string => {
  const targetLength = Math.floor(text.length * progress);
  return text.substring(0, targetLength);
};

export const OverlayRenderer: React.FC<OverlayRendererProps> = ({
  formulas,
  subtitles,
  currentFrame,
  graphBounds,
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mathJaxLoaded, setMathJaxLoaded] = useState(false);
  const [renderedElements, setRenderedElements] = useState<{
    formulas: Array<{ element: FormulaElement; html: string; animationState: AnimationState }>;
    subtitles: Array<{ element: SubtitleElement; animationState: AnimationState }>;
  }>({ formulas: [], subtitles: [] });

  // MathJax初期化（改良版）
  useEffect(() => {
    const initMathJax = () => {
      if (typeof window !== "undefined" && !window.MathJax) {
        if (debug) {
          console.log("Initializing MathJax...");
        }

        // MathJaxの設定
        window.MathJax = {
          svg: {
            fontCache: "global",
          },
        };

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

  // 数式をHTMLに変換
  const renderMathToHTML = useCallback(
    async (latex: string): Promise<string> => {
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

        // フォールバック: tex2chtml (同期版)
        if (window.MathJax.tex2chtml) {
          const node = window.MathJax.tex2chtml(processedLatex, {
            display: true,
            em: 16,
            ex: 8,
          });
          if (node) {
            if (debug) {
              console.log("Successfully rendered with tex2chtml");
            }
            return node.outerHTML;
          }
        }

        // フォールバック: tex2chtmlPromise
        if (window.MathJax.tex2chtmlPromise) {
          const node = await window.MathJax.tex2chtmlPromise(processedLatex, {
            display: true,
            em: 16,
            ex: 8,
            containerWidth: 1200,
            lineWidth: 1000000,
          });

          if (node) {
            if (debug) {
              console.log("Successfully rendered with tex2chtmlPromise");
            }
            return node.outerHTML;
          }
        }

        // フォールバック: tex2svg を使用
        if (window.MathJax.tex2svg) {
          const svgNode = window.MathJax.tex2svg(latex, { display: true });
          if (svgNode) {
            if (debug) {
              console.log("Successfully rendered with tex2svg");
            }
            return svgNode.outerHTML;
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
    [mathJaxLoaded, debug]
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

          const html = await renderMathToHTML(formula.content);
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

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 10,
        overflow: "hidden",
        border: debug ? "2px solid rgba(255, 0, 0, 0.5)" : "none", // デバッグ用：オーバーレイの境界を表示
      }}
    >
      {/* デバッグ情報表示 */}
      {debug && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "8px",
            fontSize: "12px",
            zIndex: 100,
            pointerEvents: "auto",
            borderRadius: "4px",
          }}
        >
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
            graphBounds: !!graphBounds,
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

        if (!graphBounds) {
          if (debug) {
            console.log(`Formula ${index} not rendered (no graphBounds)`);
          }
          return null;
        }

        const screenPos = graphToScreen(
          element.position.x,
          element.position.y,
          graphBounds,
          exportWidth,
          exportHeight,
          displayScale,
          displayOffsetX,
          displayOffsetY
        );

        if (debug) {
          console.log(`Formula ${index} screen position:`, screenPos);
        }

        // アニメーション効果の計算
        let opacity = element.style.opacity * animationState.progress;
        let scale = element.style.scale;
        let translateX = 0;
        let transform = "";

        switch (element.animation?.type) {
          case "typewriter":
            opacity = element.style.opacity;
            break;
          case "fade":
            opacity = element.style.opacity * animationState.progress;
            break;
          case "scale":
            scale = element.style.scale * animationState.progress;
            break;
          case "slide":
            translateX = (1 - animationState.progress) * -50;
            break;
        }

        transform = `translate(${screenPos.x + translateX}px, ${screenPos.y}px) scale(${scale}) ${
          element.style.rotation ? `rotate(${element.style.rotation}deg)` : ""
        }`;

        return (
          <div
            key={`formula-${element.id}-${index}`}
            className="formula-overlay-element"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform,
              transformOrigin: "center center",
              opacity,
              fontSize: `${element.style.fontSize * displayScale}px`,
              color: element.style.color,
              backgroundColor: debug
                ? element.style.backgroundColor || "rgba(255, 255, 0, 0.3)"
                : element.style.backgroundColor || "transparent",
              padding: element.style.backgroundColor || debug ? "8px" : "0",
              borderRadius: element.style.backgroundColor || debug ? "4px" : "0",
              pointerEvents: "none",
              zIndex: 20,
              border: debug ? "1px solid red" : "none", // デバッグ用ボーダー
              // MathJaxのスタイルを確実に適用するためのCSS
              fontFamily: "inherit",
              lineHeight: "1.2",
              textAlign: "center",
              // 高品質レンダリングのためのCSS
              WebkitFontSmoothing: "antialiased",
              fontSmooth: "always",
              textRendering: "optimizeLegibility",
              // コンテナ内のSVGやMathJax要素を適切に表示
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "1em",
            }}
          >
            <div
              style={{
                fontSize: "inherit",
                color: "inherit",
                lineHeight: "1",
                textAlign: "center",
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
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
        let opacity = element.style.opacity * animationState.progress;
        let translateX = 0;

        switch (element.animation?.type) {
          case "typewriter":
            displayText = getTypewriterText(element.text, animationState.progress);
            opacity = element.style.opacity;
            break;
          case "fade":
            opacity = element.style.opacity * animationState.progress;
            break;
          case "slide":
            translateX = (1 - animationState.progress) * -100;
            break;
        }

        const transform = `translate(${screenX + translateX}px, ${screenY}px)`;

        return (
          <div
            key={`subtitle-${element.id}-${index}`}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
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
              fontFamily: element.style.fontFamily || "Arial",
              fontWeight: element.style.fontWeight || "normal",
              textAlign: element.style.textAlign || "center",
              pointerEvents: "none",
              zIndex: 20,
              whiteSpace: "pre-wrap",
              border: debug ? "1px solid blue" : "none", // デバッグ用ボーダー
              // 高品質レンダリングのためのCSS
              WebkitFontSmoothing: "antialiased",
              fontSmooth: "always",
              textRendering: "optimizeLegibility",
            }}
          >
            {displayText}
          </div>
        );
      })}
    </div>
  );
};
