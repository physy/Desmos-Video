import React, { useState, useCallback } from "react";
import type { FormulaElement, SubtitleElement, FormulaEvent } from "../types/formula";

interface FormulaEditPanelProps {
  formulas: FormulaElement[];
  subtitles: SubtitleElement[];
  currentFrame: number;
  selectedElementId?: string;
  onElementUpdate: (element: FormulaElement | SubtitleElement) => void;
  onElementDelete: (elementId: string) => void;
  onElementCreate: (element: Omit<FormulaElement | SubtitleElement, "id">) => void;
  onElementSelect: (elementId: string | null) => void;
}

export const FormulaEditPanel: React.FC<FormulaEditPanelProps> = ({
  formulas,
  subtitles,
  currentFrame,
  selectedElementId,
  onElementUpdate,
  onElementDelete,
  onElementCreate,
  onElementSelect,
}) => {
  const [editMode, setEditMode] = useState<"formula" | "subtitle">("formula");
  const [isCreating, setIsCreating] = useState(false);

  const selectedElement = selectedElementId
    ? [...formulas, ...subtitles].find((el) => el.id === selectedElementId)
    : null;

  // 新しい要素の初期値
  const getNewFormulaDefaults = useCallback(
    (): Omit<FormulaElement, "id"> => ({
      content: "\\frac{d}{dx}f(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
      position: { x: 0, y: 0 },
      style: {
        fontSize: 24,
        color: "#000000",
        opacity: 1,
        scale: 1,
      },
      animation: {
        type: "typewriter",
        duration: 60,
        delay: 0,
        easing: "ease-out",
      },
      visible: true,
      frame: currentFrame,
    }),
    [currentFrame]
  );

  const getNewSubtitleDefaults = useCallback(
    (): Omit<SubtitleElement, "id"> => ({
      text: "数式の説明文をここに入力",
      position: { x: 0.5, y: 0.9 },
      style: {
        fontSize: 18,
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.7)",
        opacity: 1,
        fontFamily: "Arial",
        fontWeight: "normal",
        textAlign: "center",
      },
      animation: {
        type: "fade",
        duration: 30,
        delay: 0,
        easing: "ease-out",
      },
      visible: true,
      frame: currentFrame,
    }),
    [currentFrame]
  );

  const handleCreateNew = useCallback(() => {
    if (editMode === "formula") {
      onElementCreate(getNewFormulaDefaults());
    } else {
      onElementCreate(getNewSubtitleDefaults());
    }
    setIsCreating(false);
  }, [editMode, onElementCreate, getNewFormulaDefaults, getNewSubtitleDefaults]);

  const handleUpdateElement = useCallback(
    (updates: Partial<FormulaElement | SubtitleElement>) => {
      if (!selectedElement) return;
      const updatedElement = { ...selectedElement, ...updates } as FormulaElement | SubtitleElement;
      onElementUpdate(updatedElement);
    },
    [selectedElement, onElementUpdate]
  );

  const isFormula = (
    element: FormulaElement | SubtitleElement | null
  ): element is FormulaElement => {
    return element !== null && "content" in element;
  };

  const isSubtitle = (
    element: FormulaElement | SubtitleElement | null
  ): element is SubtitleElement => {
    return element !== null && "text" in element;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">数式・字幕編集</h3>

        {/* 作成モード切替 */}
        <div className="flex mb-3">
          <button
            onClick={() => setEditMode("formula")}
            className={`flex-1 px-3 py-1 text-xs font-medium border-r ${
              editMode === "formula"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            数式
          </button>
          <button
            onClick={() => setEditMode("subtitle")}
            className={`flex-1 px-3 py-1 text-xs font-medium ${
              editMode === "subtitle"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            字幕
          </button>
        </div>

        {/* 新規作成ボタン */}
        <button
          onClick={() => setIsCreating(true)}
          className="w-full px-3 py-2 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600"
        >
          新しい{editMode === "formula" ? "数式" : "字幕"}を追加
        </button>
      </div>

      {/* 要素一覧 */}
      <div className="mb-4">
        <h4 className="text-xs font-medium text-gray-700 mb-2">要素一覧</h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {[...formulas, ...subtitles]
            .sort((a, b) => a.frame - b.frame)
            .map((element) => {
              const isSelected = selectedElementId === element.id;
              const elementType = isFormula(element) ? "数式" : "字幕";
              const preview = isFormula(element)
                ? element.content.substring(0, 20) + (element.content.length > 20 ? "..." : "")
                : element.text.substring(0, 20) + (element.text.length > 20 ? "..." : "");

              return (
                <div
                  key={element.id}
                  onClick={() => onElementSelect(isSelected ? null : element.id)}
                  className={`p-2 text-xs border rounded cursor-pointer ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">
                        {elementType} (F{element.frame})
                      </div>
                      <div className="text-gray-500 truncate">{preview}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onElementDelete(element.id);
                      }}
                      className="ml-2 text-red-500 hover:text-red-700"
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 編集エリア */}
      <div className="flex-1 overflow-y-auto">
        {isCreating ? (
          <div className="p-3 border border-green-200 rounded bg-green-50">
            <h4 className="text-sm font-medium mb-2">
              新しい{editMode === "formula" ? "数式" : "字幕"}を作成
            </h4>
            <div className="flex space-x-2">
              <button
                onClick={handleCreateNew}
                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
              >
                作成
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : selectedElement ? (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">
              {isFormula(selectedElement) ? "数式編集" : "字幕編集"}
            </h4>

            {/* 基本設定 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">開始フレーム</label>
              <input
                type="number"
                value={selectedElement.frame}
                onChange={(e) => handleUpdateElement({ frame: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              />
            </div>

            {/* コンテンツ編集 */}
            {isFormula(selectedElement) ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">LaTeX数式</label>
                <textarea
                  value={selectedElement.content}
                  onChange={(e) => handleUpdateElement({ content: e.target.value })}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded h-20"
                  placeholder="LaTeX形式で数式を入力"
                />
              </div>
            ) : isSubtitle(selectedElement) ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">字幕テキスト</label>
                <textarea
                  value={selectedElement.text}
                  onChange={(e) => handleUpdateElement({ text: e.target.value })}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded h-16"
                  placeholder="字幕テキストを入力"
                />
              </div>
            ) : null}

            {/* 位置設定 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">位置</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">X座標</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedElement.position.x}
                    onChange={(e) =>
                      handleUpdateElement({
                        position: {
                          ...selectedElement.position,
                          x: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Y座標</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedElement.position.y}
                    onChange={(e) =>
                      handleUpdateElement({
                        position: {
                          ...selectedElement.position,
                          y: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* スタイル設定 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">スタイル</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">フォントサイズ</label>
                  <input
                    type="number"
                    value={selectedElement.style.fontSize}
                    onChange={(e) =>
                      handleUpdateElement({
                        style: {
                          ...selectedElement.style,
                          fontSize: parseInt(e.target.value) || 12,
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">色</label>
                  <input
                    type="color"
                    value={selectedElement.style.color}
                    onChange={(e) =>
                      handleUpdateElement({
                        style: { ...selectedElement.style, color: e.target.value },
                      })
                    }
                    className="w-full h-7 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* アニメーション設定 */}
            {selectedElement.animation && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  アニメーション
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">タイプ</label>
                    <select
                      value={selectedElement.animation.type}
                      onChange={(e) =>
                        handleUpdateElement({
                          animation: {
                            ...selectedElement.animation!,
                            type: e.target.value as
                              | "typewriter"
                              | "fade"
                              | "slide"
                              | "scale"
                              | "none",
                          },
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="none">なし</option>
                      <option value="typewriter">タイプライター</option>
                      <option value="fade">フェード</option>
                      <option value="slide">スライド</option>
                      <option value="scale">スケール</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">継続時間(フレーム)</label>
                      <input
                        type="number"
                        value={selectedElement.animation.duration}
                        onChange={(e) =>
                          handleUpdateElement({
                            animation: {
                              ...selectedElement.animation!,
                              duration: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">遅延(フレーム)</label>
                      <input
                        type="number"
                        value={selectedElement.animation.delay || 0}
                        onChange={(e) =>
                          handleUpdateElement({
                            animation: {
                              ...selectedElement.animation!,
                              delay: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 表示設定 */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={selectedElement.visible}
                  onChange={(e) => handleUpdateElement({ visible: e.target.checked })}
                  className="mr-1"
                />
                表示
              </label>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-xs py-8">
            要素を選択して編集するか、新しい要素を作成してください
          </div>
        )}
      </div>
    </div>
  );
};
