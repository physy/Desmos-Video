import React, { useState, useEffect } from "react";
import type { Calculator } from "../types/desmos";
import type { GraphingCalculatorOptions } from "../types/desmos";
import { CalculatorOptionsPanel } from "./CalculatorOptionsPanel";

export interface GraphSettingsPanelProps {
  computeCalculator?: Calculator | null;
  initialSettings: GraphSettings;
  initialOptions?: GraphingCalculatorOptions & { graphType?: "2d" | "3d" };
  onSave?: (settings: GraphSettings) => void;
  onOptionsSave?: (options: GraphingCalculatorOptions & { graphType?: "2d" | "3d" }) => void;
  onGraphTypeChange?: (graphType: "2d" | "3d") => void;
}

export interface GraphSettings {
  axisLineWidth: number;
  axisLineOffset: number;
  axisOpacity: number;
  curveOpacity: number;
  disableFill: boolean;
  graphLineWidth: number;
  highlight: boolean;
  labelHangingColor: string;
  labelSize: number;
  lastChangedAxis: string;
  majorAxisOpacity: number;
  minorAxisOpacity: number;
  pixelsPerLabel: number;
  pointLineWidth: number;
  squareAxes: boolean;
}

const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  axisLineWidth: 1.5,
  axisLineOffset: 0.25,
  axisOpacity: 0.9,
  curveOpacity: 0.7,
  disableFill: false,
  graphLineWidth: 2.5,
  highlight: false,
  labelHangingColor: "rgba(150,150,150,1)",
  labelSize: 14,
  lastChangedAxis: "x",
  majorAxisOpacity: 0.4,
  minorAxisOpacity: 0.12,
  pixelsPerLabel: 80,
  pointLineWidth: 9,
  squareAxes: false,
};

export const GraphSettingsPanel: React.FC<GraphSettingsPanelProps> = ({
  computeCalculator,
  initialSettings,
  initialOptions,
  onSave,
  onOptionsSave,
  onGraphTypeChange,
}) => {
  const [settings, setSettings] = useState<GraphSettings>(
    initialSettings ?? DEFAULT_GRAPH_SETTINGS
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "options">("settings");

  // initialSettingsが変化したらsettingsも更新し、computeCalculatorにも反映
  useEffect(() => {
    setSettings(initialSettings ?? DEFAULT_GRAPH_SETTINGS);
    setHasUnsavedChanges(false);

    // computeCalculatorにも反映
    if (
      computeCalculator &&
      computeCalculator.controller &&
      computeCalculator.controller.graphSettings
    ) {
      const gs = computeCalculator.controller.graphSettings as Partial<GraphSettings>;
      (Object.keys(initialSettings ?? DEFAULT_GRAPH_SETTINGS) as (keyof GraphSettings)[]).forEach(
        (key) => {
          const value = (initialSettings ?? DEFAULT_GRAPH_SETTINGS)[key];
          if (typeof value === "number") {
            (gs[key] as number | undefined) = value as number;
          } else if (typeof value === "boolean") {
            (gs[key] as boolean | undefined) = value as boolean;
          } else {
            (gs[key] as string | undefined) = value as string;
          }
        }
      );
    }
  }, [initialSettings, computeCalculator]);

  const handleChange = <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    if (
      computeCalculator &&
      computeCalculator.controller &&
      computeCalculator.controller.graphSettings
    ) {
      const gs = computeCalculator.controller.graphSettings as Partial<GraphSettings>;
      (Object.keys(settings) as (keyof GraphSettings)[]).forEach((key) => {
        // 型ごとに明示的に代入
        if (typeof settings[key] === "number") {
          (gs[key] as number | undefined) = settings[key] as number;
        } else if (typeof settings[key] === "boolean") {
          (gs[key] as boolean | undefined) = settings[key] as boolean;
        } else {
          (gs[key] as string | undefined) = settings[key] as string;
        }
      });
    }
    setHasUnsavedChanges(false);
    if (typeof onSave === "function") onSave(settings);
  };

  return (
    <div className="h-full flex flex-col">
      {/* タブヘッダー */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 px-2 py-2 text-xs font-medium ${
            activeTab === "settings"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Graph Settings
        </button>
        <button
          onClick={() => setActiveTab("options")}
          className={`flex-1 px-2 py-2 text-xs font-medium ${
            activeTab === "options"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Calculator Options
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "settings" && (
          <div className="p-4 space-y-6 max-h-full overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">グラフ描画設定</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(settings).map(([key, value]) => {
                if (typeof value === "boolean") {
                  return (
                    <div key={key}>
                      <label className="text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) =>
                            handleChange(key as keyof GraphSettings, e.target.checked)
                          }
                          className="mr-2"
                        />
                        {key}
                      </label>
                    </div>
                  );
                }
                return (
                  <div key={key}>
                    <label className="text-xs font-medium mb-1 block">{key}</label>
                    <input
                      type={typeof value === "number" ? "number" : "text"}
                      value={value}
                      onChange={(e) =>
                        handleChange(
                          key as keyof GraphSettings,
                          typeof value === "number" ? Number(e.target.value) : e.target.value
                        )
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex space-x-3 pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                  !hasUnsavedChanges
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-md"
                }`}
              >
                {hasUnsavedChanges ? "変更を保存" : "保存済み"}
              </button>
              {hasUnsavedChanges && (
                <button
                  onClick={() => {
                    setSettings(initialSettings);
                    setHasUnsavedChanges(false);
                  }}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-sm font-medium"
                >
                  変更を破棄
                </button>
              )}
            </div>
            {hasUnsavedChanges && (
              <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-3">
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
        )}

        {activeTab === "options" && (
          <CalculatorOptionsPanel
            initialOptions={initialOptions || { graphType: "2d" }}
            onSave={onOptionsSave}
            onGraphTypeChange={onGraphTypeChange}
          />
        )}
      </div>
    </div>
  );
};
