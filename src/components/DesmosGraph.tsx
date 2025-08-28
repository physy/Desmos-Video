import React, { useEffect, useRef, useState } from "react";
import type { Calculator, GraphingCalculatorOptions } from "../types/desmos";
import type { StateManager } from "../utils/stateManager";

interface DesmosGraphProps {
  options?: GraphingCalculatorOptions;
  onCalculatorReady?: (calculator: Calculator) => void;
  className?: string;
  aspectRatio?: number; // 縦横比 (width/height) デフォルト: 16/9
  currentFrame?: number;
  stateManager?: StateManager | null;
  fps?: number;
}

export const DesmosGraph: React.FC<DesmosGraphProps> = ({
  options = {},
  onCalculatorReady,
  className = "w-full h-full",
  aspectRatio = 16 / 9, // フルHDのアスペクト比をデフォルトに
  currentFrame,
  stateManager,
  fps = 30,
}) => {
  // frame→秒変換関数
  const frameToSeconds = (frame: number) => (fps ? frame / fps : frame / 30);
  // 例: 現在フレームの秒数表示（UIに追加する場合）
  // <div>現在: {currentFrame}フレーム ({frameToSeconds(currentFrame).toFixed(2)}秒)</div>
  // currentFrameが変化したらstateManagerから状態を取得してcalculatorへ反映
  useEffect(() => {
    if (!calculatorRef.current || !stateManager || typeof currentFrame !== "number") return;
    (async () => {
      try {
        const state = await stateManager.getStateAtFrame(currentFrame);
        if (
          calculatorRef.current &&
          state &&
          typeof stateManager.applyStateToCalculator === "function"
        ) {
          stateManager.applyStateToCalculator(state, calculatorRef.current);
        }
      } catch (e) {
        console.warn("Failed to apply state at frame", currentFrame, e);
      }
    })();
  }, [currentFrame, stateManager]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const calculatorRef = useRef<Calculator | null>(null);
  const isInitializedRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerStyle, setContainerStyle] = useState<React.CSSProperties>({});

  // onCalculatorReadyの参照を安定化
  const onCalculatorReadyRef = useRef(onCalculatorReady);
  onCalculatorReadyRef.current = onCalculatorReady;

  // optionsの参照を安定化
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let mounted = true;

    const initializeCalculator = () => {
      if (!containerRef.current || !window.Desmos || isInitializedRef.current || !mounted) return;

      const defaultOptions: GraphingCalculatorOptions = {
        keypad: false,
        expressions: true,
        expressionsCollapsed: true,
        settingsMenu: true,
        zoomButtons: false,
        expressionsTopbar: true,
        pointsOfInterest: false,
        trace: false,
        border: false,
        lockViewport: false,
        branding: false,
        pasteGraphLink: true,
        language: "ja",
        ...optionsRef.current,
      };

      try {
        calculatorRef.current = window.Desmos.GraphingCalculator(
          containerRef.current,
          defaultOptions
        );
        isInitializedRef.current = true;
        if (onCalculatorReadyRef.current && calculatorRef.current) {
          onCalculatorReadyRef.current(calculatorRef.current);
        }
      } catch (error) {
        console.error("Failed to initialize Desmos calculator:", error);
      }
    };

    // Desmos API script を動的に読み込み
    const loadDesmosAPI = () => {
      if (window.Desmos) {
        setIsLoaded(true);
        initializeCalculator();
        return;
      }

      const script = document.createElement("script");
      // script.src = "https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6&lang=ja";
      script.src = "/Desmos-Video/desmos/calculator.js";
      script.async = true;
      script.onload = () => {
        if (mounted) {
          setIsLoaded(true);
          initializeCalculator();
        }
      };

      script.onerror = () => {
        console.error("Failed to load Desmos API");
      };

      document.head.appendChild(script);
    };

    loadDesmosAPI();

    return () => {
      mounted = false;
      if (calculatorRef.current) {
        try {
          calculatorRef.current.destroy();
        } catch (error) {
          console.error("Error destroying calculator:", error);
        }
        calculatorRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []); // 依存関係を空の配列にして一度だけ実行

  // ResizeObserverで親DOMサイズ変化を監視し、グラフ領域サイズを再計算
  useEffect(() => {
    function updateContainerStyle() {
      if (!wrapperRef.current) return;
      const parent = wrapperRef.current;
      const parentWidth = parent.offsetWidth;
      const parentHeight = parent.offsetHeight;
      if (!parentWidth || !parentHeight) return;
      const parentAspect = parentWidth / parentHeight;
      let width = parentWidth;
      let height = parentHeight;
      if (parentAspect > aspectRatio) {
        // 親が横長→高さ基準
        height = parentHeight;
        width = height * aspectRatio;
      } else {
        // 親が縦長→幅基準
        width = parentWidth;
        height = width / aspectRatio;
      }
      setContainerStyle({
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: "100%",
        maxHeight: "100%",
        minHeight: "200px",
        minWidth: "200px",
        background: "#fff",
        margin: "auto",
        overflow: "hidden",
      });
      // Desmosのresize
      if (calculatorRef.current) {
        setTimeout(() => {
          try {
            calculatorRef.current?.resize();
          } catch (error) {
            console.error("Error resizing calculator:", error);
          }
        }, 100);
      }
    }
    updateContainerStyle();
    // ResizeObserverで親DOMサイズ変化を監視
    let observer: ResizeObserver | null = null;
    const observedElem = wrapperRef.current;
    if (observedElem && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateContainerStyle();
      });
      observer.observe(observedElem);
    }
    // windowリサイズにも対応
    window.addEventListener("resize", updateContainerStyle);
    return () => {
      window.removeEventListener("resize", updateContainerStyle);
      if (observer && observedElem) {
        observer.unobserve(observedElem);
        observer.disconnect();
      }
    };
  }, [aspectRatio]);

  return (
    <div
      ref={wrapperRef}
      className={`${className} relative flex items-center justify-center overflow-hidden`}
      style={{ width: "100%", height: "100%" }}
    >
      {/* アスペクト比を維持し中央配置 */}
      <div className="flex items-center justify-center w-full h-full bg-gray-100">
        <div ref={containerRef} style={containerStyle} />
      </div>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-gray-600">Loading Desmos Calculator...</div>
        </div>
      )}
    </div>
  );
};
