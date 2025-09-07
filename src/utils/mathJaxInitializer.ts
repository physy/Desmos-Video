/**
 * MathJax初期化ユーティリティ
 * OverlayRendererから分離されたMathJax初期化処理
 */

// MathJax初期化状態の管理
let mathJaxInitialized = false;
let mathJaxLoading = false;
const mathJaxLoadCallbacks: Array<(loaded: boolean) => void> = [];

// MathJaxがロード完了したかどうかを確認
export function isMathJaxLoaded(): boolean {
  return mathJaxInitialized && !!window.MathJax;
}

// MathJaxの初期化（非同期）
export function initializeMathJax(debug = false): Promise<boolean> {
  return new Promise((resolve) => {
    // 既に初期化済みの場合
    if (mathJaxInitialized) {
      if (debug) {
        console.log("MathJax already initialized");
      }
      resolve(true);
      return;
    }

    // 既に初期化中の場合はコールバックを追加
    if (mathJaxLoading) {
      if (debug) {
        console.log("MathJax initialization already in progress, adding callback");
      }
      mathJaxLoadCallbacks.push(resolve);
      return;
    }

    mathJaxLoading = true;

    if (debug) {
      console.log("Starting MathJax initialization...");
    }

    // MathJaxがすでに存在する場合
    if (typeof window !== "undefined" && window.MathJax) {
      if (debug) {
        console.log("MathJax already exists, setting loaded state");
      }
      mathJaxInitialized = true;
      mathJaxLoading = false;
      // 待機中のコールバックを実行
      mathJaxLoadCallbacks.forEach((callback) => callback(true));
      mathJaxLoadCallbacks.length = 0;
      resolve(true);
      return;
    }

    // MathJaxの設定（SVG出力最適化）
    if (typeof window !== "undefined" && !window.MathJax) {
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
        console.log("MathJax script loaded successfully");
      }

      // 少し待ってから初期化完了とする
      setTimeout(() => {
        mathJaxInitialized = true;
        mathJaxLoading = false;

        if (debug) {
          console.log("MathJax initialization completed");
        }

        // 待機中のコールバックを実行
        mathJaxLoadCallbacks.forEach((callback) => callback(true));
        mathJaxLoadCallbacks.length = 0;
        resolve(true);
      }, 200);
    };

    mathJaxScript.onerror = (error) => {
      console.error("Failed to load MathJax script:", error);
      mathJaxLoading = false;

      // 待機中のコールバックを実行（エラー）
      mathJaxLoadCallbacks.forEach((callback) => callback(false));
      mathJaxLoadCallbacks.length = 0;
      resolve(false);
    };

    document.head.appendChild(mathJaxScript);
  });
}
