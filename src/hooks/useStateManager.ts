import { useRef, useCallback, useEffect, useState } from "react";
import type { Calculator, DesmosState } from "../types/desmos";
import type { UnifiedEvent, StateEvent } from "../types/timeline";
import { StateManager, createStateManager } from "../utils/stateManager";

interface UseStateManagerOptions {
  initialState: DesmosState;
  displayCalculator: Calculator | null;
  autoCreateComputeCalculator?: boolean;
}

interface UseStateManagerReturn {
  stateManager: StateManager | null;
  applyStateAtTime: (time: number) => Promise<void>;
  addEvent: (event: UnifiedEvent) => void;
  updateEvent: (eventId: string, updates: Partial<UnifiedEvent>) => boolean;
  removeEvent: (eventId: string) => boolean;
  addStateEvent: (stateEvent: StateEvent) => void;
  createStateEventFromCurrentCalculator: (time: number, description?: string) => StateEvent | null;
  clearCache: () => void;
  debugStateCalculation: (time: number) => Promise<{
    eventsApplied: Array<UnifiedEvent | StateEvent>;
    finalState: DesmosState;
  } | null>;
  getDebugInfo: () => (Record<string, unknown> | null) & {
    computeCalculatorSet: boolean;
    stateManagerExists: boolean;
  };
}

export function useStateManager({
  initialState,
  displayCalculator,
  autoCreateComputeCalculator = true,
}: UseStateManagerOptions): UseStateManagerReturn {
  const stateManagerRef = useRef<StateManager | null>(null);
  const computeCalculatorRef = useRef<Calculator | null>(null);
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
      stateManagerRef.current = createStateManager(initialState);
      console.log("[useStateManager] StateManager created");
    }
  }, [initialState]);

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

    try {
      const computeCalculator = window.Desmos.GraphingCalculator(computeDiv, {
        // 計算専用なので最小限の設定
        expressions: false,
        graphpaper: false,
        zoomButtons: false,
        autosize: false,
        showResetButtonOnGraphpaper: false,
      });

      computeCalculatorRef.current = computeCalculator;
      console.log("[useStateManager] Compute calculator created successfully");

      // StateManagerに設定
      if (stateManagerRef.current) {
        stateManagerRef.current.setComputeCalculator(computeCalculator);
        console.log("[useStateManager] Compute calculator set to StateManager");
      }
    } catch (error) {
      console.error("[useStateManager] Failed to create compute calculator:", error);
    }

    // クリーンアップ関数
    return () => {
      if (computeDiv.parentNode) {
        computeDiv.parentNode.removeChild(computeDiv);
      }
    };
  }, [desmosReady, autoCreateComputeCalculator]);

  // 指定時刻の状態を表示用calculatorに適用
  const applyStateAtTime = useCallback(
    async (time: number) => {
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
        await stateManagerRef.current.applyStateAtTime(time, displayCalculator);
        console.log(`[useStateManager] Successfully applied state at time ${time}s`);
      } catch (error) {
        console.error(`[useStateManager] Failed to apply state at time ${time}:`, error);
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
    (time: number, description?: string): StateEvent | null => {
      if (!stateManagerRef.current || !displayCalculator) return null;

      try {
        return stateManagerRef.current.createStateEventFromCalculator(
          time,
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

  // デバッグ用：状態計算過程を表示
  const debugStateCalculation = useCallback(async (time: number) => {
    if (!stateManagerRef.current) return null;

    try {
      return await stateManagerRef.current.debugStateCalculation(time);
    } catch (error) {
      console.error(`[useStateManager] Debug calculation failed for time ${time}:`, error);
      return null;
    }
  }, []);

  // デバッグ情報を取得
  const getDebugInfo = useCallback(() => {
    if (!stateManagerRef.current) return null;
    return stateManagerRef.current.getDebugInfo();
  }, []);

  return {
    stateManager: stateManagerRef.current,
    applyStateAtTime,
    addEvent,
    updateEvent,
    removeEvent,
    addStateEvent,
    createStateEventFromCurrentCalculator,
    clearCache,
    debugStateCalculation,
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
