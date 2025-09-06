import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import type { Calculator, DesmosState, GraphingCalculatorOptions } from "../types/desmos";
import type { UnifiedEvent, StateEvent } from "../types/timeline";
import { StateManager, createStateManager } from "../utils/stateManager";

interface UseStateManagerOptions {
  displayCalculator: Calculator | null;
  autoCreateComputeCalculator?: boolean;
  calculatorOptions?: GraphingCalculatorOptions & { graphType?: "2d" | "3d" };
}

interface UseStateManagerReturn {
  stateManager: StateManager | null;
  applyStateAtFrame: (frame: number) => Promise<void>;
  addEvent: (event: UnifiedEvent) => void;
  updateEvent: (eventId: string, updates: Partial<UnifiedEvent>) => boolean;
  removeEvent: (eventId: string) => boolean;
  addStateEvent: (stateEvent: StateEvent) => void;
  createStateEventFromCurrentCalculator: (frame: number, description?: string) => StateEvent | null;
  clearCache: () => void;
  getDebugInfo: () => (Record<string, unknown> | null) & {
    computeCalculatorSet: boolean;
    stateManagerExists: boolean;
  };
}

export function useStateManager({
  displayCalculator,
  autoCreateComputeCalculator = true,
  calculatorOptions,
}: UseStateManagerOptions): UseStateManagerReturn {
  const stateManagerRef = useRef<StateManager | null>(null);
  const computeCalculatorRef = useRef<Calculator | null>(null);
  const computeDivRef = useRef<HTMLDivElement | null>(null);
  const evaluationCalculatorRef = useRef<Calculator | null>(null);
  const evaluationDivRef = useRef<HTMLDivElement | null>(null);
  const [desmosReady, setDesmosReady] = useState(false);

  // Desmosライブラリの準備状況をチェック
  useEffect(() => {
    const checkDesmos = () => {
      if (
        typeof window !== "undefined" &&
        typeof window.Desmos !== "undefined" &&
        typeof window.Desmos.GraphingCalculator === "function"
      ) {
        setDesmosReady(true);
        console.log("[useStateManager] Desmos library is ready");
        return true;
      }
      return false;
    };

    if (checkDesmos()) {
      return;
    }

    // Desmosライブラリの読み込みを待つ
    const interval = setInterval(() => {
      if (checkDesmos()) {
        clearInterval(interval);
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      console.warn("[useStateManager] Timeout waiting for Desmos library");
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  // StateManagerを初期化
  useEffect(() => {
    if (!stateManagerRef.current) {
      stateManagerRef.current = createStateManager();
      console.log("[useStateManager] StateManager created");
    }
  }, []);

  // 計算用calculatorの基本設定（変更しない）
  const baseComputeOptions: GraphingCalculatorOptions = useMemo(
    () => ({
      // expressions: false,
      // graphpaper: false,
      // zoomButtons: false,
      // autosize: false,
      showResetButtonOnGraphpaper: false,
    }),
    []
  );

  // 計算用calculatorを作成・設定（Desmosライブラリが準備できてから）
  useEffect(() => {
    if (!desmosReady || !autoCreateComputeCalculator || computeCalculatorRef.current) {
      return;
    }

    console.log("[useStateManager] Creating compute calculator...");

    // 非表示のdivを作成
    const computeDiv = document.createElement("div");
    computeDiv.style.display = "none";
    computeDiv.style.width = "400px";
    computeDiv.style.height = "300px";
    document.body.appendChild(computeDiv);
    computeDivRef.current = computeDiv;

    try {
      // calculatorOptionsから適用可能な設定を抽出（graphTypeは除く）
      const { graphType, ...applicableOptions } = calculatorOptions || {};

      // 基本設定を上書きしないように、calculatorOptionsの設定をマージ
      const finalOptions = {
        ...applicableOptions, // calculatorOptionsの設定を先に
        ...baseComputeOptions, // 基本設定で上書き（重要な設定を保護）
      };

      // graphTypeに基づいて適切なコンストラクタを使用
      const selectedGraphType = calculatorOptions?.graphType || "2d";
      let computeCalculator: Calculator;

      if (selectedGraphType === "3d") {
        // Calculator3Dを使用
        computeCalculator = window.Desmos.Calculator3D?.(computeDiv, finalOptions);
        console.log("[useStateManager] Creating 3D compute calculator");
      } else {
        // GraphingCalculatorを使用（デフォルト）
        computeCalculator = window.Desmos.GraphingCalculator(computeDiv, finalOptions);
        console.log("[useStateManager] Creating 2D compute calculator");
      }

      computeCalculatorRef.current = computeCalculator;
      console.log(
        "[useStateManager] Compute calculator created successfully with options:",
        finalOptions
      );

      // StateManagerに設定
      if (stateManagerRef.current) {
        stateManagerRef.current.setComputeCalculator(computeCalculator);
        console.log("[useStateManager] Compute calculator set to StateManager");
      }

      // 評価専用calculatorも作成
      const evaluationDiv = document.createElement("div");
      evaluationDiv.style.display = "none";
      evaluationDiv.style.width = "400px";
      evaluationDiv.style.height = "300px";
      document.body.appendChild(evaluationDiv);

      let evaluationCalculator: Calculator;
      if (selectedGraphType === "3d") {
        evaluationCalculator = window.Desmos.Calculator3D?.(evaluationDiv, finalOptions);
        console.log("[useStateManager] Creating 3D evaluation calculator");
      } else {
        evaluationCalculator = window.Desmos.GraphingCalculator(evaluationDiv, finalOptions);
        console.log("[useStateManager] Creating 2D evaluation calculator");
      }
      evaluationCalculatorRef.current = evaluationCalculator;
      evaluationDivRef.current = evaluationDiv;

      // StateManagerに評価専用calculatorも設定
      if (stateManagerRef.current) {
        stateManagerRef.current.setEvaluationCalculator(evaluationCalculator);
        console.log("[useStateManager] Evaluation calculator set to StateManager");
      }
    } catch (error) {
      console.error("[useStateManager] Failed to create compute calculator:", error);
    }

    // クリーンアップ関数（destroyしない！）
    return () => {
      // 計算用calculatorはdestroyしない
      // ただしdivはDOMから削除してOK
      if (computeDivRef.current && computeDivRef.current.parentNode) {
        computeDivRef.current.parentNode.removeChild(computeDivRef.current);
        computeDivRef.current = null;
      }
      // computeCalculatorRef.currentは保持
    };
  }, [desmosReady, autoCreateComputeCalculator, calculatorOptions, baseComputeOptions]);

  // calculatorOptionsが変更された時にcomputeCalculatorを再作成
  useEffect(() => {
    if (!desmosReady || !autoCreateComputeCalculator || !computeCalculatorRef.current) {
      return;
    }

    console.log("[useStateManager] Calculator options changed, recreating compute calculator...");

    // 既存のcomputeCalculator,evaluationCalculatorとDOMを完全に破棄
    try {
      if (computeCalculatorRef.current) {
        console.log("[useStateManager] Destroying old compute calculator...");
        computeCalculatorRef.current.destroy();
        computeCalculatorRef.current = null;
      }

      if (evaluationCalculatorRef.current) {
        console.log("[useStateManager] Destroying old evaluation calculator...");
        evaluationCalculatorRef.current.destroy();
        evaluationCalculatorRef.current = null;
      }

      // 既存のdivも削除
      if (computeDivRef.current && computeDivRef.current.parentNode) {
        computeDivRef.current.parentNode.removeChild(computeDivRef.current);
        computeDivRef.current = null;
      }

      if (evaluationDivRef.current && evaluationDivRef.current.parentNode) {
        evaluationDivRef.current.parentNode.removeChild(evaluationDivRef.current);
        evaluationDivRef.current = null;
      }
    } catch (error) {
      console.error("[useStateManager] Error destroying old compute calculator:", error);
    }

    // 新しい非表示のdivを作成
    const computeDiv = document.createElement("div");
    computeDiv.style.display = "none";
    computeDiv.style.width = "400px";
    computeDiv.style.height = "300px";
    document.body.appendChild(computeDiv);
    computeDivRef.current = computeDiv;

    try {
      // calculatorOptionsから適用可能な設定を抽出（graphTypeは除く）
      const { graphType, ...applicableOptions } = calculatorOptions || {};

      // 基本設定を上書きしないように、calculatorOptionsの設定をマージ
      const finalOptions = {
        ...applicableOptions, // calculatorOptionsの設定を先に
        ...baseComputeOptions, // 基本設定で上書き（重要な設定を保護）
      };

      // graphTypeに基づいて適切なコンストラクタを使用
      const selectedGraphType = calculatorOptions?.graphType || "2d";
      let computeCalculator: Calculator;

      if (selectedGraphType === "3d") {
        // Calculator3Dを使用
        computeCalculator = window.Desmos.Calculator3D?.(computeDiv, finalOptions);
        console.log("[useStateManager] Recreating 3D compute calculator");
      } else {
        // GraphingCalculatorを使用（デフォルト）
        computeCalculator = window.Desmos.GraphingCalculator(computeDiv, finalOptions);
        console.log("[useStateManager] Recreating 2D compute calculator");
      }

      computeCalculatorRef.current = computeCalculator;
      console.log(
        "[useStateManager] Compute calculator recreated successfully with new options:",
        finalOptions
      );

      // StateManagerに設定
      if (stateManagerRef.current) {
        stateManagerRef.current.setComputeCalculator(computeCalculator);
        console.log("[useStateManager] New compute calculator set to StateManager");
      }
      computeDivRef.current = computeDiv;

      // 評価専用calculatorも再作成
      const evaluationDiv = document.createElement("div");
      evaluationDiv.style.display = "none";
      evaluationDiv.style.width = "400px";
      evaluationDiv.style.height = "300px";
      document.body.appendChild(evaluationDiv);

      let evaluationCalculator: Calculator;
      if (selectedGraphType === "3d") {
        evaluationCalculator = window.Desmos.Calculator3D?.(evaluationDiv, finalOptions);
        console.log("[useStateManager] Recreating 3D evaluation calculator");
      } else {
        evaluationCalculator = window.Desmos.GraphingCalculator(evaluationDiv, finalOptions);
        console.log("[useStateManager] Recreating 2D evaluation calculator");
      }
      evaluationCalculatorRef.current = evaluationCalculator;

      // StateManagerに評価専用calculatorも設定
      if (stateManagerRef.current) {
        stateManagerRef.current.setEvaluationCalculator(evaluationCalculator);
        console.log("[useStateManager] New evaluation calculator set to StateManager");
      }
      evaluationDivRef.current = evaluationDiv;
    } catch (error) {
      console.error("[useStateManager] Failed to recreate compute calculator:", error);
    }

    // クリーンアップ関数
    return () => {
      if (computeDivRef.current && computeDivRef.current.parentNode) {
        computeDivRef.current.parentNode.removeChild(computeDivRef.current);
        computeDivRef.current = null;
      }
    };
  }, [calculatorOptions, desmosReady, autoCreateComputeCalculator, baseComputeOptions]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      console.log("[useStateManager] Component unmounting, cleaning up compute calculator...");

      // computeCalculatorを破棄
      try {
        if (computeCalculatorRef.current) {
          computeCalculatorRef.current.destroy();
          computeCalculatorRef.current = null;
        }
        if (evaluationCalculatorRef.current) {
          evaluationCalculatorRef.current.destroy();
          evaluationCalculatorRef.current = null;
        }
      } catch (error) {
        console.error("[useStateManager] Error destroying compute calculator on unmount:", error);
      }

      // divも削除
      if (computeDivRef.current && computeDivRef.current.parentNode) {
        computeDivRef.current.parentNode.removeChild(computeDivRef.current);
        computeDivRef.current = null;
      }

      if (evaluationDivRef.current && evaluationDivRef.current.parentNode) {
        evaluationDivRef.current.parentNode.removeChild(evaluationDivRef.current);
        evaluationDivRef.current = null;
      }
    };
  }, []);

  // 指定時刻の状態を表示用calculatorに適用
  const applyStateAtFrame = useCallback(
    async (frame: number) => {
      if (!stateManagerRef.current || !displayCalculator) {
        console.warn("[useStateManager] StateManager or display calculator not available");
        return;
      }

      // Compute calculatorが設定されているかチェック
      if (!computeCalculatorRef.current) {
        console.error(
          "[useStateManager] Compute calculator not available. Auto-creation may have failed."
        );
        return;
      }

      try {
        await stateManagerRef.current.applyStateAtFrame(frame, displayCalculator);
        console.log(`[useStateManager] Successfully applied state at frame ${frame}`);
      } catch (error) {
        console.error(`[useStateManager] Failed to apply state at frame ${frame}:`, error);
      }
    },
    [displayCalculator]
  );

  // イベントを追加
  const addEvent = useCallback((event: UnifiedEvent) => {
    if (!stateManagerRef.current) return;
    stateManagerRef.current.addEvent(event);
  }, []);

  // イベントを更新
  const updateEvent = useCallback((eventId: string, updates: Partial<UnifiedEvent>) => {
    if (!stateManagerRef.current) return false;
    return stateManagerRef.current.updateEvent(eventId, updates);
  }, []);

  // イベントを削除
  const removeEvent = useCallback((eventId: string) => {
    if (!stateManagerRef.current) return false;
    return stateManagerRef.current.removeEvent(eventId);
  }, []);

  // StateEventを追加
  const addStateEvent = useCallback((stateEvent: StateEvent) => {
    if (!stateManagerRef.current) return;
    stateManagerRef.current.addStateEvent(stateEvent);
  }, []);

  // 現在のcalculatorの状態からStateEventを作成
  const createStateEventFromCurrentCalculator = useCallback(
    (frame: number, description?: string): StateEvent | null => {
      if (!stateManagerRef.current || !displayCalculator) return null;

      try {
        return stateManagerRef.current.createStateEventFromCalculator(
          frame,
          displayCalculator,
          description
        );
      } catch (error) {
        console.error("[useStateManager] Failed to create state event:", error);
        return null;
      }
    },
    [displayCalculator]
  );

  // キャッシュをクリア
  const clearCache = useCallback(() => {
    if (!stateManagerRef.current) return;
    stateManagerRef.current.clearCache();
  }, []);

  // デバッグ情報を取得
  const getDebugInfo = useCallback(() => {
    if (!stateManagerRef.current) return null;
    return stateManagerRef.current.getDebugInfo();
  }, []);

  return {
    stateManager: stateManagerRef.current,
    applyStateAtFrame,
    addEvent,
    updateEvent,
    removeEvent,
    addStateEvent,
    createStateEventFromCurrentCalculator,
    clearCache,
    getDebugInfo: () => {
      const baseDebug = getDebugInfo();
      return {
        ...baseDebug,
        computeCalculatorSet: !!computeCalculatorRef.current,
        stateManagerExists: !!stateManagerRef.current,
      };
    },
  };
}
