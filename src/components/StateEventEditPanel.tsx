import React, { useState, useEffect } from "react";
import type { StateEvent } from "../types/timeline";
import type { Calculator } from "../types/desmos";

export interface StateEventEditPanelProps {
  selectedState: StateEvent | null;
  onStateUpdate: (state: StateEvent) => void;
  onStateDelete?: () => void;
  onDeselect?: () => void;
  calculator?: Calculator | null;
  // isInitialState削除
}

export const StateEventEditPanel: React.FC<StateEventEditPanelProps & { currentTime?: number }> = ({
  selectedState,
  onStateUpdate,
  onStateDelete,
  onDeselect,
  calculator,
  currentTime,
  // isInitialState削除
}) => {
  // 選択中state or calculatorの現在state
  const initialStateJson = selectedState
    ? JSON.stringify(selectedState.state, null, 2)
    : calculator
    ? JSON.stringify(calculator.getState(), null, 2)
    : "{}";

  const [editingState, setEditingState] = useState<StateEvent | null>(selectedState);
  const [editingStateJson, setEditingStateJson] = useState<string>(initialStateJson);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isJsonValid, setIsJsonValid] = useState(true);
  // 新規State挿入用（editingStateがnullの場合も）
  const isNewState = !selectedState;
  const [newStateTime, setNewStateTime] = useState<number>(currentTime ?? 0);
  // calculatorの変更を既存StateのJSON textareaにも即時反映（setStateは呼ばない）
  const [isSyncFromCalculator, setIsSyncFromCalculator] = useState(false);

  // Desmos APIのchangeイベントでcalculator編集→JSON反映
  useEffect(() => {
    if (!selectedState && calculator) {
      const handler = () => {
        const stateJson = JSON.stringify(calculator.getState(), null, 2);
        setEditingStateJson(stateJson);
      };
      calculator.observeEvent("change", handler);
      return () => {
        calculator.unobserveEvent("change", handler);
      };
    }
  }, [calculator, selectedState]);

  // calculatorの変更を既存StateのJSON textareaにも即時反映（setStateは呼ばない）
  useEffect(() => {
    if (selectedState && calculator) {
      const handler = () => {
        const stateJson = JSON.stringify(calculator.getState(), null, 2);
        setIsSyncFromCalculator(true);
        setEditingStateJson(stateJson);
      };
      calculator.observeEvent("change", handler);
      return () => {
        calculator.unobserveEvent("change", handler);
      };
    }
  }, [calculator, selectedState]);

  // JSON編集時にcalculatorへ即反映（既存State編集時のみ、calculator→textarea反映時は除外）
  useEffect(() => {
    if (selectedState && calculator && !isSyncFromCalculator) {
      try {
        const parsed = JSON.parse(editingStateJson);
        calculator.setState(parsed);
      } catch {
        // JSON不正時は何もしない
      }
    }
    // isSyncFromCalculatorは副作用で管理するため、依存配列には含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingStateJson, calculator, selectedState]);

  // isSyncFromCalculatorがtrueのときだけfalseに戻す副作用
  useEffect(() => {
    if (isSyncFromCalculator) {
      setIsSyncFromCalculator(false);
    }
  }, [isSyncFromCalculator]);

  useEffect(() => {
    if (selectedState) {
      setEditingState(selectedState);
      setEditingStateJson(JSON.stringify(selectedState.state, null, 2));
      setHasUnsavedChanges(false);
      setIsJsonValid(true);
    } else if (calculator) {
      setEditingState(null);
      setEditingStateJson(JSON.stringify(calculator.getState(), null, 2));
      setHasUnsavedChanges(true); // 新規State挿入時はtrueに
      setIsJsonValid(true);
    }
  }, [selectedState, calculator]);

  useEffect(() => {
    if (isNewState && typeof currentTime === "number") {
      setNewStateTime(currentTime);
    }
  }, [isNewState, currentTime]);

  const handleJsonApply = () => {
    try {
      const parsed = JSON.parse(editingStateJson);
      handleStateChange({ state: parsed });
      setIsJsonValid(true);
    } catch {
      setIsJsonValid(false);
    }
  };

  useEffect(() => {
    try {
      JSON.parse(editingStateJson);
      setIsJsonValid(true);
    } catch {
      setIsJsonValid(false);
    }
  }, [editingStateJson]);

  // タイムラインの何も無い部分クリックで選択解除
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // パネル外かつDesmos calculator外クリック時のみ選択解除
      if (!target.closest(".state-event-edit-panel") && !target.closest(".dcg-container")) {
        if (onDeselect) onDeselect();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onDeselect]);

  const handleStateChange = (updates: Partial<StateEvent>) => {
    if (!editingState) return;
    setEditingState({ ...editingState, ...updates });
    setHasUnsavedChanges(true);
  };

  const handleSaveOrInsert = () => {
    if (isNewState && isJsonValid && hasUnsavedChanges) {
      // 新規StateEvent挿入
      const parsed = JSON.parse(editingStateJson);
      onStateUpdate({
        frame: newStateTime,
        type: "state",
        state: parsed,
        id: `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });
      setHasUnsavedChanges(false);
    } else if (editingState && hasUnsavedChanges) {
      // 既存StateEvent更新
      onStateUpdate(editingState);
      setHasUnsavedChanges(false);
    }
  };

  if (!editingState) {
    return (
      <div className="p-4 space-y-4 state-event-edit-panel">
        <h2 className="text-lg font-semibold">新規State挿入</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">実行フレーム</label>
          <input
            type="number"
            value={newStateTime}
            onChange={(e) => setNewStateTime(parseInt(e.target.value))}
            step="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="mt-2 bg-gray-50 border rounded p-2 text-xs font-mono overflow-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1">JSON</label>
          <textarea
            value={editingStateJson}
            onChange={(e) => {
              setEditingStateJson(e.target.value);
              setHasUnsavedChanges(true);
              setIsSyncFromCalculator(false); // ユーザー編集時は必ずfalse
            }}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              lineHeight: "1.6",
              fontSize: "0.95em",
            }}
          />
          <button
            onClick={handleSaveOrInsert}
            className="mt-2 px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            disabled={!isJsonValid || !hasUnsavedChanges}
          >
            新規Stateを挿入
          </button>
          {!isJsonValid && (
            <div className="mt-1 text-xs text-red-500">JSONの形式が正しくありません</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 state-event-edit-panel">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">State編集</h2>
        <button
          onClick={onStateDelete}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          削除
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">実行フレーム</label>
          <input
            type="number"
            value={editingState.frame}
            onChange={(e) => handleStateChange({ frame: parseInt(e.target.value) })}
            step="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="mt-2 bg-gray-50 border rounded p-2 text-xs font-mono overflow-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State JSON（直接編集可）
          </label>
          <textarea
            value={editingStateJson}
            onChange={(e) => setEditingStateJson(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              lineHeight: "1.6",
              fontSize: "0.95em",
            }}
          />
          <button
            onClick={handleJsonApply}
            className="mt-2 px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            disabled={!isJsonValid}
          >
            JSONを反映
          </button>
          {!isJsonValid && (
            <div className="mt-1 text-xs text-red-500">JSONの形式が正しくありません</div>
          )}
        </div>
        <div className="flex space-x-3 pt-6 border-t border-gray-200">
          <button
            onClick={handleSaveOrInsert}
            disabled={!hasUnsavedChanges || (isNewState && !isJsonValid)}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
              !hasUnsavedChanges
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-md"
            }`}
          >
            {isNewState ? "新規Stateを挿入" : hasUnsavedChanges ? "変更を保存" : "保存済み"}
          </button>
          {!isNewState && hasUnsavedChanges && (
            <button
              onClick={() => {
                setEditingState(selectedState);
                setEditingStateJson(
                  selectedState ? JSON.stringify(selectedState.state, null, 2) : ""
                );
                setHasUnsavedChanges(false);
              }}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-sm font-medium"
            >
              変更を破棄
            </button>
          )}
        </div>
        {hasUnsavedChanges && (
          <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.349 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span>未保存の変更があります</span>
          </div>
        )}
      </div>
      <style>{`
        .state-event-edit-panel.initial-state-selected {
          border: 2px solid #3b82f6;
          background: #f0f8ff;
        }
      `}</style>
    </div>
  );
};
