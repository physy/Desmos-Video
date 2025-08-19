import React, { useState, useEffect } from "react";
import type { UnifiedEvent } from "../types/timeline";

export interface UnifiedEventEditPanelProps {
  selectedEvent: UnifiedEvent | null;
  onEventUpdate: (event: UnifiedEvent) => void;
  onEventDelete: () => void;
  availableExpressions: Array<{ id: string; latex: string; color?: string }>;
  getCurrentExpressions?: () => Array<{ id: string; latex?: string; color?: string }>;
}

export const UnifiedEventEditPanel: React.FC<UnifiedEventEditPanelProps> = ({
  selectedEvent,
  onEventUpdate,
  onEventDelete,
  availableExpressions,
  getCurrentExpressions,
}) => {
  const [editingEvent, setEditingEvent] = useState<UnifiedEvent | null>(null);

  useEffect(() => {
    setEditingEvent(selectedEvent);
  }, [selectedEvent]);

  // 現在の式を取得（リアルタイム更新のため）
  const currentExpressions = getCurrentExpressions ? getCurrentExpressions() : availableExpressions;

  if (!editingEvent) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>タイムライン上のイベントを選択してください</p>
        <div className="mt-4 text-sm">
          <p>または、タイムラインをダブルクリックして新しいイベントを追加</p>
        </div>
      </div>
    );
  }

  const handleEventChange = (updates: Partial<UnifiedEvent>) => {
    if (!editingEvent) return;
    const updatedEvent = { ...editingEvent, ...updates };
    setEditingEvent(updatedEvent);
  };

  const handleSave = () => {
    if (editingEvent) {
      onEventUpdate(editingEvent);
    }
  };

  const renderExpressionEventEditor = () => {
    if (editingEvent.type !== "expression") return null;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">対象Expression ID</label>
          <select
            value={editingEvent.expressionId || ""}
            onChange={(e) => handleEventChange({ expressionId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">選択してください</option>
            {currentExpressions
              .filter((expr) => expr.id && expr.latex)
              .map((expr) => (
                <option key={expr.id} value={expr.id}>
                  {expr.id} - {expr.latex}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">変更するプロパティ</h3>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingEvent.properties?.latex !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleEventChange({
                      properties: {
                        ...editingEvent.properties,
                        latex: editingEvent.properties?.latex || "y = x",
                      },
                    });
                  } else {
                    const newProps = { ...editingEvent.properties };
                    delete newProps.latex;
                    handleEventChange({ properties: newProps });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm">数式 (latex)</span>
            </label>
            {editingEvent.properties?.latex !== undefined && (
              <input
                type="text"
                value={editingEvent.properties.latex as string}
                onChange={(e) =>
                  handleEventChange({
                    properties: {
                      ...editingEvent.properties,
                      latex: e.target.value,
                    },
                  })
                }
                placeholder="y = x^2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingEvent.properties?.color !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleEventChange({
                      properties: {
                        ...editingEvent.properties,
                        color: editingEvent.properties?.color || "#2563eb",
                      },
                    });
                  } else {
                    const newProps = { ...editingEvent.properties };
                    delete newProps.color;
                    handleEventChange({ properties: newProps });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm">色</span>
            </label>
            {editingEvent.properties?.color !== undefined && (
              <input
                type="color"
                value={editingEvent.properties.color as string}
                onChange={(e) =>
                  handleEventChange({
                    properties: {
                      ...editingEvent.properties,
                      color: e.target.value,
                    },
                  })
                }
                className="w-16 h-8 border border-gray-300 rounded"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingEvent.properties?.hidden !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleEventChange({
                      properties: {
                        ...editingEvent.properties,
                        hidden: editingEvent.properties?.hidden || false,
                      },
                    });
                  } else {
                    const newProps = { ...editingEvent.properties };
                    delete newProps.hidden;
                    handleEventChange({ properties: newProps });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm">表示/非表示</span>
            </label>
            {editingEvent.properties?.hidden !== undefined && (
              <select
                value={editingEvent.properties.hidden ? "true" : "false"}
                onChange={(e) =>
                  handleEventChange({
                    properties: {
                      ...editingEvent.properties,
                      hidden: e.target.value === "true",
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="false">表示</option>
                <option value="true">非表示</option>
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingEvent.properties?.lineStyle !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleEventChange({
                      properties: {
                        ...editingEvent.properties,
                        lineStyle: editingEvent.properties?.lineStyle || "SOLID",
                      },
                    });
                  } else {
                    const newProps = { ...editingEvent.properties };
                    delete newProps.lineStyle;
                    handleEventChange({ properties: newProps });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm">線のスタイル</span>
            </label>
            {editingEvent.properties?.lineStyle !== undefined && (
              <select
                value={editingEvent.properties.lineStyle as string}
                onChange={(e) =>
                  handleEventChange({
                    properties: {
                      ...editingEvent.properties,
                      lineStyle: e.target.value as "SOLID" | "DASHED" | "DOTTED",
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="SOLID">実線</option>
                <option value="DASHED">破線</option>
                <option value="DOTTED">点線</option>
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingEvent.properties?.lineWidth !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleEventChange({
                      properties: {
                        ...editingEvent.properties,
                        lineWidth: editingEvent.properties?.lineWidth || 2.5,
                      },
                    });
                  } else {
                    const newProps = { ...editingEvent.properties };
                    delete newProps.lineWidth;
                    handleEventChange({ properties: newProps });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm">線の太さ</span>
            </label>
            {editingEvent.properties?.lineWidth !== undefined && (
              <input
                type="number"
                value={editingEvent.properties.lineWidth as number}
                onChange={(e) =>
                  handleEventChange({
                    properties: {
                      ...editingEvent.properties,
                      lineWidth: parseFloat(e.target.value),
                    },
                  })
                }
                min="0.5"
                max="10"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingEvent.properties?.lineOpacity !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleEventChange({
                      properties: {
                        ...editingEvent.properties,
                        lineOpacity: editingEvent.properties?.lineOpacity || 0.9,
                      },
                    });
                  } else {
                    const newProps = { ...editingEvent.properties };
                    delete newProps.lineOpacity;
                    handleEventChange({ properties: newProps });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm">線の透明度</span>
            </label>
            {editingEvent.properties?.lineOpacity !== undefined && (
              <input
                type="range"
                value={editingEvent.properties.lineOpacity as number}
                onChange={(e) =>
                  handleEventChange({
                    properties: {
                      ...editingEvent.properties,
                      lineOpacity: parseFloat(e.target.value),
                    },
                  })
                }
                min="0"
                max="1"
                step="0.1"
                className="w-full"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editingEvent.properties?.fillOpacity !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleEventChange({
                      properties: {
                        ...editingEvent.properties,
                        fillOpacity: editingEvent.properties?.fillOpacity || 0.4,
                      },
                    });
                  } else {
                    const newProps = { ...editingEvent.properties };
                    delete newProps.fillOpacity;
                    handleEventChange({ properties: newProps });
                  }
                }}
                className="mr-2"
              />
              <span className="text-sm">塗りつぶし透明度</span>
            </label>
            {editingEvent.properties?.fillOpacity !== undefined && (
              <input
                type="range"
                value={editingEvent.properties.fillOpacity as number}
                onChange={(e) =>
                  handleEventChange({
                    properties: {
                      ...editingEvent.properties,
                      fillOpacity: parseFloat(e.target.value),
                    },
                  })
                }
                min="0"
                max="1"
                step="0.1"
                className="w-full"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBoundsEventEditor = () => {
    if (editingEvent.type !== "bounds") return null;

    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">グラフ表示範囲の変更</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Left</label>
            <input
              type="number"
              value={editingEvent.bounds?.left || -10}
              onChange={(e) =>
                handleEventChange({
                  bounds: {
                    ...editingEvent.bounds,
                    left: parseFloat(e.target.value),
                    right: editingEvent.bounds?.right || 10,
                    top: editingEvent.bounds?.top || 10,
                    bottom: editingEvent.bounds?.bottom || -10,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Right</label>
            <input
              type="number"
              value={editingEvent.bounds?.right || 10}
              onChange={(e) =>
                handleEventChange({
                  bounds: {
                    ...editingEvent.bounds,
                    right: parseFloat(e.target.value),
                    left: editingEvent.bounds?.left || -10,
                    top: editingEvent.bounds?.top || 10,
                    bottom: editingEvent.bounds?.bottom || -10,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Top</label>
            <input
              type="number"
              value={editingEvent.bounds?.top || 10}
              onChange={(e) =>
                handleEventChange({
                  bounds: {
                    ...editingEvent.bounds,
                    top: parseFloat(e.target.value),
                    left: editingEvent.bounds?.left || -10,
                    right: editingEvent.bounds?.right || 10,
                    bottom: editingEvent.bounds?.bottom || -10,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bottom</label>
            <input
              type="number"
              value={editingEvent.bounds?.bottom || -10}
              onChange={(e) =>
                handleEventChange({
                  bounds: {
                    ...editingEvent.bounds,
                    bottom: parseFloat(e.target.value),
                    left: editingEvent.bounds?.left || -10,
                    right: editingEvent.bounds?.right || 10,
                    top: editingEvent.bounds?.top || 10,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderVariableEventEditor = () => {
    // 変数設定はexpressionに統合されたため、このエディタは不要
    return null;
  };

  const renderAnimationEventEditor = () => {
    if (editingEvent.type !== "animation") return null;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">変数名</label>
          <input
            type="text"
            value={editingEvent.animation?.variable || ""}
            onChange={(e) =>
              handleEventChange({
                animation: {
                  variable: e.target.value,
                  startValue: editingEvent.animation?.startValue || 0,
                  endValue: editingEvent.animation?.endValue || 1,
                  duration: editingEvent.animation?.duration || 1,
                },
              })
            }
            placeholder="t"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">開始値</label>
          <input
            type="number"
            value={editingEvent.animation?.startValue || 0}
            onChange={(e) =>
              handleEventChange({
                animation: {
                  variable: editingEvent.animation?.variable || "",
                  startValue: parseFloat(e.target.value),
                  endValue: editingEvent.animation?.endValue || 1,
                  duration: editingEvent.animation?.duration || 1,
                },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">終了値</label>
          <input
            type="number"
            value={editingEvent.animation?.endValue || 1}
            onChange={(e) =>
              handleEventChange({
                animation: {
                  variable: editingEvent.animation?.variable || "",
                  startValue: editingEvent.animation?.startValue || 0,
                  endValue: parseFloat(e.target.value),
                  duration: editingEvent.animation?.duration || 1,
                },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            アニメーション時間（秒）
          </label>
          <input
            type="number"
            value={editingEvent.animation?.duration || 1}
            onChange={(e) =>
              handleEventChange({
                animation: {
                  variable: editingEvent.animation?.variable || "",
                  startValue: editingEvent.animation?.startValue || 0,
                  endValue: editingEvent.animation?.endValue || 1,
                  duration: parseFloat(e.target.value),
                },
              })
            }
            step="0.1"
            min="0.1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">イベント編集</h2>
        <button
          onClick={onEventDelete}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          削除
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">実行時刻（秒）</label>
          <input
            type="number"
            value={editingEvent.time}
            onChange={(e) => handleEventChange({ time: parseFloat(e.target.value) })}
            step="0.1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">イベントタイプ</label>
          <select
            value={editingEvent.type}
            onChange={(e) =>
              handleEventChange({
                type: e.target.value as UnifiedEvent["type"],
                // タイプ変更時は関連プロパティをリセット
                ...(e.target.value === "expression" && {
                  expressionId: "",
                  properties: {},
                  bounds: undefined,
                  animation: undefined,
                }),
                ...(e.target.value === "bounds" && {
                  bounds: { left: -10, right: 10, top: 10, bottom: -10 },
                  expressionId: undefined,
                  properties: undefined,
                  animation: undefined,
                }),
                ...(e.target.value === "animation" && {
                  animation: { variable: "", startValue: 0, endValue: 1, duration: 1 },
                  expressionId: undefined,
                  properties: undefined,
                  bounds: undefined,
                }),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="expression">Expression変更</option>
            <option value="bounds">表示範囲変更</option>
            <option value="animation">変数アニメーション</option>
          </select>
        </div>

        {renderExpressionEventEditor()}
        {renderBoundsEventEditor()}
        {renderVariableEventEditor()}
        {renderAnimationEventEditor()}

        <div className="flex space-x-2 pt-4">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
