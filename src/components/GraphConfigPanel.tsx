import React, { useState, useEffect } from "react";
import type { Calculator, GraphingCalculatorOptions, MathBounds } from "../types/desmos";

export interface GraphConfigPanelProps {
  calculator: Calculator | null;
  onConfigUpdate?: (config: Partial<GraphingCalculatorOptions>) => void;
}

export const GraphConfigPanel: React.FC<GraphConfigPanelProps> = ({
  calculator,
  onConfigUpdate,
}) => {
  const [config, setConfig] = useState<Partial<GraphingCalculatorOptions>>({});
  const [mathBounds, setMathBounds] = useState<MathBounds>({
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
  });

  // 現在の設定を取得
  useEffect(() => {
    if (calculator) {
      // 現在のmathBoundsを取得
      const currentBounds = calculator.graphpaperBounds?.mathCoordinates;
      if (currentBounds) {
        setMathBounds({
          left: currentBounds.left,
          right: currentBounds.right,
          top: currentBounds.top,
          bottom: currentBounds.bottom,
        });
      }
    }
  }, [calculator]);

  const handleConfigChange = (key: keyof GraphingCalculatorOptions, value: unknown) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);

    // 設定をすぐに適用
    if (calculator) {
      calculator.updateSettings({ [key]: value });
    }

    onConfigUpdate?.(newConfig);
  };

  const handleMathBoundsChange = (key: keyof MathBounds, value: number) => {
    const newBounds = { ...mathBounds, [key]: value };
    setMathBounds(newBounds);

    // 数値の検証
    if (newBounds.left < newBounds.right && newBounds.bottom < newBounds.top) {
      if (calculator) {
        calculator.setMathBounds(newBounds);
      }
    }
  };

  const resetToDefault = () => {
    const defaultBounds = { left: -10, right: 10, top: 10, bottom: -10 };
    setMathBounds(defaultBounds);
    if (calculator) {
      calculator.setMathBounds(defaultBounds);
    }
  };

  const fitToContent = () => {
    // グラフの内容に合わせてズーム（簡易実装）
    const expressions = calculator?.getExpressions() || [];
    if (expressions.length > 0) {
      // 基本的な調整: より狭い範囲にズーム
      const newBounds = { left: -5, right: 5, top: 5, bottom: -5 };
      setMathBounds(newBounds);
      if (calculator) {
        calculator.setMathBounds(newBounds);
      }
    }
  };

  if (!calculator) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>計算機が初期化されていません</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-h-full overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold mb-4">グラフ設定</h2>
      </div>

      {/* 表示範囲設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">表示範囲</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Left (X最小)</label>
            <input
              type="number"
              value={mathBounds.left}
              onChange={(e) => handleMathBoundsChange("left", parseFloat(e.target.value))}
              step="0.5"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Right (X最大)</label>
            <input
              type="number"
              value={mathBounds.right}
              onChange={(e) => handleMathBoundsChange("right", parseFloat(e.target.value))}
              step="0.5"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Top (Y最大)</label>
            <input
              type="number"
              value={mathBounds.top}
              onChange={(e) => handleMathBoundsChange("top", parseFloat(e.target.value))}
              step="0.5"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bottom (Y最小)</label>
            <input
              type="number"
              value={mathBounds.bottom}
              onChange={(e) => handleMathBoundsChange("bottom", parseFloat(e.target.value))}
              step="0.5"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={resetToDefault}
            className="flex-1 px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
          >
            デフォルト
          </button>
          <button
            onClick={fitToContent}
            className="flex-1 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            内容に合わせる
          </button>
        </div>
      </div>

      {/* グリッドと軸の表示設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">表示オプション</h3>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.showGrid ?? true}
              onChange={(e) => handleConfigChange("showGrid", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">グリッド表示</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.showXAxis ?? true}
              onChange={(e) => handleConfigChange("showXAxis", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">X軸表示</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.showYAxis ?? true}
              onChange={(e) => handleConfigChange("showYAxis", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">Y軸表示</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.xAxisNumbers ?? true}
              onChange={(e) => handleConfigChange("xAxisNumbers", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">X軸数値表示</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.yAxisNumbers ?? true}
              onChange={(e) => handleConfigChange("yAxisNumbers", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">Y軸数値表示</span>
          </label>
        </div>
      </div>

      {/* 軸設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">軸設定</h3>

        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">X軸ラベル</label>
            <input
              type="text"
              value={config.xAxisLabel || ""}
              onChange={(e) => handleConfigChange("xAxisLabel", e.target.value)}
              placeholder="x"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Y軸ラベル</label>
            <input
              type="text"
              value={config.yAxisLabel || ""}
              onChange={(e) => handleConfigChange("yAxisLabel", e.target.value)}
              placeholder="y"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">X軸スケール</label>
            <select
              value={config.xAxisScale || "linear"}
              onChange={(e) => handleConfigChange("xAxisScale", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="linear">線形</option>
              <option value="logarithmic">対数</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Y軸スケール</label>
            <select
              value={config.yAxisScale || "linear"}
              onChange={(e) => handleConfigChange("yAxisScale", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="linear">線形</option>
              <option value="logarithmic">対数</option>
            </select>
          </div>
        </div>
      </div>

      {/* その他の設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">その他</h3>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.polarMode ?? false}
              onChange={(e) => handleConfigChange("polarMode", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">極座標モード</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.degreeMode ?? false}
              onChange={(e) => handleConfigChange("degreeMode", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">度数法モード</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.lockViewport ?? false}
              onChange={(e) => handleConfigChange("lockViewport", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">ビューポートロック</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.projectorMode ?? false}
              onChange={(e) => handleConfigChange("projectorMode", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">プロジェクターモード</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            フォントサイズ: {config.fontSize || 16}px
          </label>
          <input
            type="range"
            min="12"
            max="24"
            value={config.fontSize || 16}
            onChange={(e) => handleConfigChange("fontSize", parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* UI要素設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">UI要素</h3>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.zoomButtons ?? true}
              onChange={(e) => handleConfigChange("zoomButtons", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">ズームボタン</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.trace ?? false}
              onChange={(e) => handleConfigChange("trace", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">トレース機能</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.pointsOfInterest ?? false}
              onChange={(e) => handleConfigChange("pointsOfInterest", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">注目点表示</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.settingsMenu ?? true}
              onChange={(e) => handleConfigChange("settingsMenu", e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">設定メニュー</span>
          </label>
        </div>
      </div>

      {/* 現在の設定情報 */}
      <div className="space-y-2 pt-4 border-t">
        <h3 className="text-xs font-medium text-gray-500">現在の表示範囲</h3>
        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
          <div>幅: {(mathBounds.right - mathBounds.left).toFixed(1)} 単位</div>
          <div>高さ: {(mathBounds.top - mathBounds.bottom).toFixed(1)} 単位</div>
          <div>
            中心: ({((mathBounds.left + mathBounds.right) / 2).toFixed(1)},{" "}
            {((mathBounds.top + mathBounds.bottom) / 2).toFixed(1)})
          </div>
        </div>
      </div>
    </div>
  );
};
