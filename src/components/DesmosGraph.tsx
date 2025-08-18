import React, { useEffect, useRef, useState } from "react";
import type { Calculator, GraphingCalculatorOptions } from "../types/desmos";

interface DesmosGraphProps {
  options?: GraphingCalculatorOptions;
  onCalculatorReady?: (calculator: Calculator) => void;
  className?: string;
}

export const DesmosGraph: React.FC<DesmosGraphProps> = ({
  options = {},
  onCalculatorReady,
  className = "w-full h-full",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<Calculator | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
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
        settingsMenu: true,
        zoomButtons: true,
        expressionsTopbar: true,
        pointsOfInterest: false,
        trace: false,
        border: false,
        lockViewport: false,
        branding: false,
        mathBounds: {
          left: -10,
          right: 10,
          top: 10,
          bottom: -10,
        },
        ...optionsRef.current,
      };

      try {
        calculatorRef.current = window.Desmos.GraphingCalculator(
          containerRef.current,
          defaultOptions
        );

        if (mounted) {
          isInitializedRef.current = true;

          if (onCalculatorReadyRef.current && calculatorRef.current) {
            onCalculatorReadyRef.current(calculatorRef.current);
          }
        }
      } catch (error) {
        console.error("Failed to initialize Desmos calculator:", error);
      }
    };

    // Desmos API script を動的に読み込み
    const loadDesmosAPI = () => {
      if (window.Desmos) {
        initializeCalculator();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";
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

  return (
    <div className={className}>
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: "400px" }} />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-600">Loading Desmos Calculator...</div>
        </div>
      )}
    </div>
  );
};
