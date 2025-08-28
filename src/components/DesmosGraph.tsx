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

  // アスペクト比が変更されたときにリサイズ
  useEffect(() => {
    console.log("DesmosGraph: aspectRatio changed to", aspectRatio);
    if (calculatorRef.current) {
      setTimeout(() => {
        try {
          calculatorRef.current?.resize();
          console.log("DesmosGraph: Calculator resized for aspect ratio", aspectRatio);
        } catch (error) {
          console.error("Error resizing calculator:", error);
        }
      }, 100);
    }
  }, [aspectRatio]);

  return (
    <div className={`${className} relative flex items-center justify-center overflow-hidden`}>
      {/* 常にアスペクト比を適用：object-fit:containのような挙動 */}
      <div className="flex items-center justify-center w-full h-full bg-gray-100">
        <div
          ref={containerRef}
          style={{
            aspectRatio: aspectRatio.toString(),
            width: aspectRatio > 1 ? "100%" : "auto", // 横長なら幅100%
            height: aspectRatio <= 1 ? "100%" : "auto", // 縦長なら高さ100%
            maxWidth: "100%",
            maxHeight: "100%",
            minHeight: "200px",
            minWidth: "200px",
          }}
        />
      </div>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-gray-600">Loading Desmos Calculator...</div>
        </div>
      )}
    </div>
  );
};
