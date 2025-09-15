import React, { useState, useEffect } from "react";
import type { UnifiedEvent } from "../types/timeline";
import { DynamicPropertyEditor } from "./DynamicPropertyEditor";
import { PROPERTY_CONFIGS } from "../utils/propertyConfigs";
import { deepCopy } from "../utils/deepCopy";

export interface UnifiedEventEditPanelProps {
  selectedEvent: UnifiedEvent | null;
  onEventUpdate: (event: UnifiedEvent) => void;
  onEventDelete: () => void;
}

export const UnifiedEventEditPanel: React.FC<UnifiedEventEditPanelProps> = ({
  selectedEvent,
  onEventUpdate,
  onEventDelete,
}) => {
  const [editingEvent, setEditingEvent] = useState<UnifiedEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setEditingEvent(selectedEvent);
    setHasUnsavedChanges(false);
  }, [selectedEvent]);

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
    const updatedEvent = deepCopy(editingEvent);
    Object.assign(updatedEvent, updates);
    setEditingEvent(updatedEvent);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (editingEvent && hasUnsavedChanges) {
      setIsSaving(true);
      try {
        // 保存処理の実行
        onEventUpdate(editingEvent);
        setHasUnsavedChanges(false);

        // 保存完了のフィードバックのために少し待機
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error("保存エラー:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const renderExpressionEventEditor = () => {
    if (editingEvent.type !== "expression") return null;

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">変更するプロパティ</h3>

          <DynamicPropertyEditor
            properties={editingEvent.properties || {}}
            onPropertyChange={(key, value) => {
              // 現在のプロパティをディープコピーしてから変更
              const currentProperties = deepCopy(editingEvent.properties || {}) as Record<
                string,
                unknown
              >;
              currentProperties[key] = value;

              handleEventChange({
                properties: currentProperties,
              });
            }}
            onPropertyAdd={(key) => {
              const config = PROPERTY_CONFIGS[key];
              if (config) {
                // 現在のプロパティをディープコピーしてから追加
                const currentProperties = deepCopy(editingEvent.properties || {}) as Record<
                  string,
                  unknown
                >;
                currentProperties[key] = config.defaultValue;

                handleEventChange({
                  properties: currentProperties,
                });
              }
            }}
            onPropertyRemove={(key) => {
              // 現在のプロパティをディープコピーしてから削除
              const currentProperties = deepCopy(editingEvent.properties || {}) as Record<
                string,
                unknown
              >;
              delete currentProperties[key];

              handleEventChange({
                properties: currentProperties,
              });
            }}
          />
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
              value={editingEvent.bounds?.left ?? -10}
              onChange={(e) => {
                const currentBounds = deepCopy(
                  editingEvent.bounds || {
                    left: -10,
                    right: 10,
                    top: 10,
                    bottom: -10,
                  }
                );
                currentBounds.left = parseFloat(e.target.value);

                handleEventChange({
                  bounds: currentBounds,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Right</label>
            <input
              type="number"
              value={editingEvent.bounds?.right ?? 10}
              onChange={(e) => {
                const currentBounds = deepCopy(
                  editingEvent.bounds || {
                    left: -10,
                    right: 10,
                    top: 10,
                    bottom: -10,
                  }
                );
                currentBounds.right = parseFloat(e.target.value);

                handleEventChange({
                  bounds: currentBounds,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Top</label>
            <input
              type="number"
              value={editingEvent.bounds?.top ?? 10}
              onChange={(e) => {
                const currentBounds = deepCopy(
                  editingEvent.bounds || {
                    left: -10,
                    right: 10,
                    top: 10,
                    bottom: -10,
                  }
                );
                currentBounds.top = parseFloat(e.target.value);

                handleEventChange({
                  bounds: currentBounds,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bottom</label>
            <input
              type="number"
              value={editingEvent.bounds?.bottom ?? -10}
              onChange={(e) => {
                const currentBounds = deepCopy(
                  editingEvent.bounds || {
                    left: -10,
                    right: 10,
                    top: 10,
                    bottom: -10,
                  }
                );
                currentBounds.bottom = parseFloat(e.target.value);

                handleEventChange({
                  bounds: currentBounds,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderAnimationEventEditor = () => {
    if (editingEvent.type !== "animation") return null;

    const currentAnimation = editingEvent.animation || {
      type: "variable",
      targetId: "",
      durationFrames: 30,
      variable: { name: "", startValue: 0, endValue: 1, autoDetect: false },
      easing: "linear",
    };

    return (
      <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
        <h4 className="text-sm font-medium text-gray-700">アニメーション設定</h4>

        {/* アニメーションタイプ選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            アニメーションタイプ
          </label>
          <select
            value={currentAnimation.type || "variable"}
            onChange={(e) => {
              const newType = e.target.value as "variable" | "property" | "action" | "bounds";
              const newAnimation = {
                type: newType,
                targetId: currentAnimation.targetId || "",
                durationFrames:
                  newType === "action"
                    ? 10 * 1 // デフォルト: steps=10, frameInterval=1
                    : currentAnimation.durationFrames || 30,
                easing: newType === "action" ? undefined : currentAnimation.easing || "linear",
                ...(newType === "variable" && {
                  variable: { name: "", startValue: 0, endValue: 1, autoDetect: false },
                }),
                ...(newType === "property" && {
                  property: { name: "", startValue: 0, endValue: 1 },
                }),
                ...(newType === "action" && {
                  action: { steps: 10, frameInterval: 1 },
                }),
                ...(newType === "bounds" && {
                  bounds: {
                    scale: { endValue: 2 },
                    translation: { endX: 0, endY: 0, mode: "displacement" as const },
                  },
                }),
              };
              handleEventChange({ animation: newAnimation });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="variable">変数値アニメーション</option>
            <option value="property">プロパティアニメーション</option>
            <option value="action">アクション実行</option>
            <option value="bounds">表示範囲アニメーション</option>
          </select>
        </div>

        {/* 対象Expression ID - boundsアニメーション以外で表示 */}
        {currentAnimation.type !== "bounds" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              対象Expression ID
            </label>
            <input
              type="text"
              value={currentAnimation.targetId || ""}
              onChange={(e) => {
                handleEventChange({
                  animation: { ...currentAnimation, targetId: e.target.value },
                });
              }}
              placeholder="expression-id"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* アニメーション時間 - actionタイプ以外で表示 */}
        {currentAnimation.type !== "action" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              アニメーションフレーム数
            </label>
            <input
              type="number"
              value={currentAnimation.durationFrames || 30}
              onChange={(e) => {
                handleEventChange({
                  animation: { ...currentAnimation, durationFrames: parseInt(e.target.value) },
                });
              }}
              step="1"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* 変数アニメーション設定 */}
        {currentAnimation.type === "variable" && (
          <div className="space-y-3 p-3 border border-blue-200 rounded-lg bg-blue-50">
            <h5 className="text-sm font-medium text-blue-800">変数アニメーション設定</h5>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoDetect"
                checked={currentAnimation.variable?.autoDetect || false}
                onChange={(e) => {
                  const variable = currentAnimation.variable || {
                    name: "",
                    startValue: 0,
                    endValue: 1,
                    autoDetect: false,
                  };
                  handleEventChange({
                    animation: {
                      ...currentAnimation,
                      variable: { ...variable, autoDetect: e.target.checked },
                    },
                  });
                }}
                className="rounded"
              />
              <label htmlFor="autoDetect" className="text-sm text-gray-700">
                LaTeXから変数名を自動検出
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">変数名</label>
              <input
                type="text"
                value={currentAnimation.variable?.name || ""}
                onChange={(e) => {
                  const variable = currentAnimation.variable || {
                    name: "",
                    startValue: 0,
                    endValue: 1,
                    autoDetect: false,
                  };
                  handleEventChange({
                    animation: {
                      ...currentAnimation,
                      variable: { ...variable, name: e.target.value },
                    },
                  });
                }}
                placeholder={
                  currentAnimation.variable?.autoDetect ? "自動検出されます" : "t, x, aなど"
                }
                disabled={currentAnimation.variable?.autoDetect}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始値</label>
                <input
                  type="number"
                  value={currentAnimation.variable?.startValue ?? 0}
                  onChange={(e) => {
                    const variable = currentAnimation.variable || {
                      name: "",
                      startValue: 0,
                      endValue: 1,
                      autoDetect: false,
                    };
                    handleEventChange({
                      animation: {
                        ...currentAnimation,
                        variable: { ...variable, startValue: parseFloat(e.target.value) },
                      },
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了値</label>
                <input
                  type="number"
                  value={currentAnimation.variable?.endValue ?? 1}
                  onChange={(e) => {
                    const variable = currentAnimation.variable || {
                      name: "",
                      startValue: 0,
                      endValue: 1,
                      autoDetect: false,
                    };
                    handleEventChange({
                      animation: {
                        ...currentAnimation,
                        variable: { ...variable, endValue: parseFloat(e.target.value) },
                      },
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* プロパティアニメーション設定 */}
        {currentAnimation.type === "property" && (
          <div className="space-y-3 p-3 border border-green-200 rounded-lg bg-green-50">
            <h5 className="text-sm font-medium text-green-800">プロパティアニメーション設定</h5>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">プロパティ名</label>
              <select
                value={currentAnimation.property?.name || ""}
                onChange={(e) => {
                  const property = currentAnimation.property || {
                    name: "",
                    startValue: 0,
                    endValue: 1,
                  };
                  handleEventChange({
                    animation: {
                      ...currentAnimation,
                      property: { ...property, name: e.target.value },
                    },
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">プロパティを選択</option>
                <option value="lineOpacity">線の透明度</option>
                <option value="pointSize">点のサイズ</option>
                <option value="lineWidth">線の太さ</option>
                <option value="fillOpacity">塗りつぶしの透明度</option>
                <option value="pointOpacity">点の透明度</option>
                <option value="movablePointSize">移動可能な点のサイズ</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始値</label>
                <input
                  type="number"
                  value={currentAnimation.property?.startValue ?? 0}
                  onChange={(e) => {
                    const property = currentAnimation.property || {
                      name: "",
                      startValue: 0,
                      endValue: 1,
                    };
                    handleEventChange({
                      animation: {
                        ...currentAnimation,
                        property: { ...property, startValue: parseFloat(e.target.value) },
                      },
                    });
                  }}
                  step="0.1"
                  min="0"
                  max="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了値</label>
                <input
                  type="number"
                  value={currentAnimation.property?.endValue ?? 1}
                  onChange={(e) => {
                    const property = currentAnimation.property || {
                      name: "",
                      startValue: 0,
                      endValue: 1,
                    };
                    handleEventChange({
                      animation: {
                        ...currentAnimation,
                        property: { ...property, endValue: parseFloat(e.target.value) },
                      },
                    });
                  }}
                  step="0.1"
                  min="0"
                  max="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* アクション実行設定 */}
        {currentAnimation.type === "action" && (
          <div className="space-y-3 p-3 border border-purple-200 rounded-lg bg-purple-50">
            <h5 className="text-sm font-medium text-purple-800">アクション実行設定</h5>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  実行ステップ数
                </label>
                <input
                  type="number"
                  value={currentAnimation.action?.steps ?? 10}
                  onChange={(e) => {
                    const action = currentAnimation.action || { steps: 10, frameInterval: 1 };
                    const newSteps = parseInt(e.target.value);
                    const durationFrames = newSteps * action.frameInterval;
                    handleEventChange({
                      animation: {
                        ...currentAnimation,
                        action: { ...action, steps: newSteps },
                        durationFrames,
                      },
                    });
                  }}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">フレーム間隔</label>
                <input
                  type="number"
                  value={currentAnimation.action?.frameInterval ?? 1}
                  onChange={(e) => {
                    const action = currentAnimation.action || { steps: 10, frameInterval: 1 };
                    const newFrameInterval = parseInt(e.target.value);
                    const durationFrames = action.steps * newFrameInterval;
                    handleEventChange({
                      animation: {
                        ...currentAnimation,
                        action: { ...action, frameInterval: newFrameInterval },
                        durationFrames,
                      },
                    });
                  }}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="text-xs text-purple-600">
              指定したIDのexpressionを {currentAnimation.action?.frameInterval ?? 1} フレームごとに{" "}
              {currentAnimation.action?.steps ?? 10} ステップ実行します
              <br />
              総実行時間:{" "}
              {(currentAnimation.action?.steps ?? 10) *
                (currentAnimation.action?.frameInterval ?? 1)}{" "}
              フレーム
            </div>
          </div>
        )}

        {/* バウンズアニメーション設定 */}
        {currentAnimation.type === "bounds" && (
          <div className="space-y-4 p-3 border border-orange-200 rounded-lg bg-orange-50">
            <h5 className="text-sm font-medium text-orange-800">表示範囲アニメーション設定</h5>

            {/* アニメーション方式選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                アニメーション方式
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="boundsMode"
                    checked={
                      !!currentAnimation.bounds?.scale || !!currentAnimation.bounds?.translation
                    }
                    onChange={() => {
                      handleEventChange({
                        animation: {
                          ...currentAnimation,
                          bounds: {
                            scale: { endValue: 2 },
                            translation: { endX: 0, endY: 0, mode: "displacement" as const },
                          },
                        },
                      });
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">スケール＋並進移動</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="boundsMode"
                    checked={!!currentAnimation.bounds?.direct}
                    onChange={() => {
                      handleEventChange({
                        animation: {
                          ...currentAnimation,
                          bounds: {
                            direct: {
                              endBounds: { left: -5, right: 5, top: 5, bottom: -5 },
                            },
                          },
                        },
                      });
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">直接的なバウンズ指定</span>
                </label>
              </div>
            </div>

            {/* スケール＋並進移動設定 */}
            {(currentAnimation.bounds?.scale || currentAnimation.bounds?.translation) && (
              <div className="space-y-4">
                {/* スケール設定 */}
                <div className="space-y-3 p-3 border border-blue-200 rounded bg-blue-50">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableScale"
                      checked={!!currentAnimation.bounds?.scale}
                      onChange={(e) => {
                        const bounds = currentAnimation.bounds || {};
                        if (e.target.checked) {
                          bounds.scale = { endValue: 2 };
                        } else {
                          delete bounds.scale;
                        }
                        handleEventChange({
                          animation: { ...currentAnimation, bounds },
                        });
                      }}
                      className="mr-2"
                    />
                    <label htmlFor="enableScale" className="text-sm font-medium text-blue-800">
                      スケールアニメーション（アスペクト比保持）
                    </label>
                  </div>

                  {currentAnimation.bounds?.scale && (
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          終了スケール
                        </label>
                        <input
                          type="number"
                          value={currentAnimation.bounds.scale.endValue}
                          onChange={(e) => {
                            const bounds = currentAnimation.bounds || {};
                            const scale = bounds.scale || { endValue: 2 };
                            scale.endValue = parseFloat(e.target.value);
                            bounds.scale = scale;
                            handleEventChange({
                              animation: { ...currentAnimation, bounds },
                            });
                          }}
                          step="0.1"
                          min="0.1"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            中心X（オプション）
                          </label>
                          <input
                            type="number"
                            value={currentAnimation.bounds.scale.centerX ?? ""}
                            onChange={(e) => {
                              const bounds = currentAnimation.bounds || {};
                              const scale = bounds.scale || { endValue: 2 };
                              scale.centerX = e.target.value
                                ? parseFloat(e.target.value)
                                : undefined;
                              bounds.scale = scale;
                              handleEventChange({
                                animation: { ...currentAnimation, bounds },
                              });
                            }}
                            placeholder="自動"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            中心Y（オプション）
                          </label>
                          <input
                            type="number"
                            value={currentAnimation.bounds.scale.centerY ?? ""}
                            onChange={(e) => {
                              const bounds = currentAnimation.bounds || {};
                              const scale = bounds.scale || { endValue: 2 };
                              scale.centerY = e.target.value
                                ? parseFloat(e.target.value)
                                : undefined;
                              bounds.scale = scale;
                              handleEventChange({
                                animation: { ...currentAnimation, bounds },
                              });
                            }}
                            placeholder="自動"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="text-xs text-blue-600">
                        開始スケールは1.0固定（現在のビュー）。終了スケールまでアニメーションします。
                      </div>
                    </div>
                  )}
                </div>

                {/* 並進移動設定 */}
                <div className="space-y-3 p-3 border border-green-200 rounded bg-green-50">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableTranslation"
                      checked={!!currentAnimation.bounds?.translation}
                      onChange={(e) => {
                        const bounds = currentAnimation.bounds || {};
                        if (e.target.checked) {
                          bounds.translation = { endX: 0, endY: 0, mode: "displacement" as const };
                        } else {
                          delete bounds.translation;
                        }
                        handleEventChange({
                          animation: { ...currentAnimation, bounds },
                        });
                      }}
                      className="mr-2"
                    />
                    <label
                      htmlFor="enableTranslation"
                      className="text-sm font-medium text-green-800"
                    >
                      並進移動アニメーション
                    </label>
                  </div>

                  {currentAnimation.bounds?.translation && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          移動モード
                        </label>
                        <select
                          value={currentAnimation.bounds.translation.mode}
                          onChange={(e) => {
                            const bounds = currentAnimation.bounds || {};
                            const translation = bounds.translation || {
                              startX: 0,
                              startY: 0,
                              endX: 0,
                              endY: 0,
                              mode: "displacement" as const,
                            };
                            translation.mode = e.target.value as "displacement" | "absolute";
                            bounds.translation = translation;
                            handleEventChange({
                              animation: { ...currentAnimation, bounds },
                            });
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="displacement">変位指定</option>
                          <option value="absolute">絶対座標指定</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            終了X
                          </label>
                          <input
                            type="number"
                            value={currentAnimation.bounds.translation.endX}
                            onChange={(e) => {
                              const bounds = currentAnimation.bounds || {};
                              const translation = bounds.translation || {
                                endX: 0,
                                endY: 0,
                                mode: "displacement" as const,
                              };
                              translation.endX = parseFloat(e.target.value);
                              bounds.translation = translation;
                              handleEventChange({
                                animation: { ...currentAnimation, bounds },
                              });
                            }}
                            step="0.1"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            終了Y
                          </label>
                          <input
                            type="number"
                            value={currentAnimation.bounds.translation.endY}
                            onChange={(e) => {
                              const bounds = currentAnimation.bounds || {};
                              const translation = bounds.translation || {
                                endX: 0,
                                endY: 0,
                                mode: "displacement" as const,
                              };
                              translation.endY = parseFloat(e.target.value);
                              bounds.translation = translation;
                              handleEventChange({
                                animation: { ...currentAnimation, bounds },
                              });
                            }}
                            step="0.1"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="text-xs text-green-600">
                        {currentAnimation.bounds.translation.mode === "displacement"
                          ? "変位モード: 現在の位置からの相対的な移動量を指定（開始は0）"
                          : "絶対座標モード: 移動先の絶対座標を指定（開始は現在の中心）"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 直接的なバウンズ指定設定 */}
            {currentAnimation.bounds?.direct && (
              <div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
                <h6 className="text-sm font-medium text-gray-800">直接的なバウンズ指定</h6>

                <div className="space-y-2">
                  <div className="text-xs text-gray-600 mb-2">
                    終了バウンズ（開始は現在のビュー）
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Left</label>
                      <input
                        type="number"
                        value={currentAnimation.bounds.direct.endBounds.left}
                        onChange={(e) => {
                          const bounds = currentAnimation.bounds || {};
                          const direct = bounds.direct || {
                            endBounds: { left: -5, right: 5, top: 5, bottom: -5 },
                          };
                          direct.endBounds.left = parseFloat(e.target.value);
                          bounds.direct = direct;
                          handleEventChange({
                            animation: { ...currentAnimation, bounds },
                          });
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Right</label>
                      <input
                        type="number"
                        value={currentAnimation.bounds.direct.endBounds.right}
                        onChange={(e) => {
                          const bounds = currentAnimation.bounds || {};
                          const direct = bounds.direct || {
                            endBounds: { left: -5, right: 5, top: 5, bottom: -5 },
                          };
                          direct.endBounds.right = parseFloat(e.target.value);
                          bounds.direct = direct;
                          handleEventChange({
                            animation: { ...currentAnimation, bounds },
                          });
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Top</label>
                      <input
                        type="number"
                        value={currentAnimation.bounds.direct.endBounds.top}
                        onChange={(e) => {
                          const bounds = currentAnimation.bounds || {};
                          const direct = bounds.direct || {
                            endBounds: { left: -5, right: 5, top: 5, bottom: -5 },
                          };
                          direct.endBounds.top = parseFloat(e.target.value);
                          bounds.direct = direct;
                          handleEventChange({
                            animation: { ...currentAnimation, bounds },
                          });
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Bottom</label>
                      <input
                        type="number"
                        value={currentAnimation.bounds.direct.endBounds.bottom}
                        onChange={(e) => {
                          const bounds = currentAnimation.bounds || {};
                          const direct = bounds.direct || {
                            endBounds: { left: -5, right: 5, top: 5, bottom: -5 },
                          };
                          direct.endBounds.bottom = parseFloat(e.target.value);
                          bounds.direct = direct;
                          handleEventChange({
                            animation: { ...currentAnimation, bounds },
                          });
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* イージング設定 - actionタイプ以外で表示 */}
        {currentAnimation.type !== "action" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">イージング関数</label>
            <select
              value={currentAnimation.easing || "linear"}
              onChange={(e) => {
                handleEventChange({
                  animation: {
                    ...currentAnimation,
                    easing: e.target.value as "linear" | "ease-in" | "ease-out" | "ease-in-out",
                  },
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="linear">リニア</option>
              <option value="ease-in">イーズイン</option>
              <option value="ease-out">イーズアウト</option>
              <option value="ease-in-out">イーズインアウト</option>
            </select>
          </div>
        )}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">実行フレーム</label>
          <input
            type="number"
            value={editingEvent.frame}
            onChange={(e) => handleEventChange({ frame: parseInt(e.target.value) })}
            step="1"
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
                ...(e.target.value === "expression" && {
                  properties: {},
                  bounds: undefined,
                  animation: undefined,
                }),
                ...(e.target.value === "bounds" && {
                  bounds: { left: -10, right: 10, top: 10, bottom: -10 },
                  properties: undefined,
                  animation: undefined,
                }),
                ...(e.target.value === "animation" && {
                  animation: {
                    type: "variable",
                    targetId: "",
                    durationFrames: 30,
                    variable: { name: "", startValue: 0, endValue: 1, autoDetect: false },
                    easing: "linear",
                  },
                  properties: undefined,
                  bounds: undefined,
                }),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="expression">Expression変更</option>
            <option value="bounds">表示範囲変更</option>
            <option value="animation">アニメーション</option>
          </select>
        </div>

        {renderExpressionEventEditor()}
        {renderBoundsEventEditor()}
        {renderAnimationEventEditor()}

        <div className="flex space-x-3 pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className={`
              flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200
              ${
                !hasUnsavedChanges
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : isSaving
                  ? "bg-blue-400 text-white cursor-wait"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-md"
              }
            `}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>保存中...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>変更を保存</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>保存済み</span>
              </>
            )}
          </button>

          {hasUnsavedChanges && (
            <button
              onClick={() => {
                setEditingEvent(selectedEvent);
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
    </div>
  );
};
