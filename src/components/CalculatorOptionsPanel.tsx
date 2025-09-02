import React, { useState, useEffect } from "react";
import type { GraphingCalculatorOptions } from "../types/desmos";

export interface CalculatorOptionsPanelProps {
  initialOptions: GraphingCalculatorOptions & { graphType?: "2d" | "3d" };
  onSave?: (options: GraphingCalculatorOptions & { graphType?: "2d" | "3d" }) => void;
  onGraphTypeChange?: (graphType: "2d" | "3d") => void;
}

// 主要なオプションのカテゴリ分け
const OPTION_CATEGORIES = {
  "UI Components": [
    "keypad",
    "graphpaper",
    "expressions",
    "settingsMenu",
    "zoomButtons",
    "expressionsTopbar",
    "pointsOfInterest",
    "trace",
    "border",
    "lockViewport",
    "expressionsCollapsed",
    "authorFeatures",
    "images",
    "folders",
    "notes",
    "sliders",
    "actions",
    "substitutions",
    "links",
    "qwertyKeyboard",
    "distributions",
  ],
  "Graph Display": [
    "showGrid",
    "showXAxis",
    "showYAxis",
    "xAxisNumbers",
    "yAxisNumbers",
    "polarNumbers",
    "polarMode",
    "degreeMode",
    "plotInequalities",
    "plotImplicits",
    "plotSingleVariableImplicitEquations",
    "projectorMode",
    "invertedColors",
  ],
  "Axis Settings": [
    "xAxisStep",
    "yAxisStep",
    "xAxisMinorSubdivisions",
    "yAxisMinorSubdivisions",
    "xAxisArrowMode",
    "yAxisArrowMode",
    "xAxisLabel",
    "yAxisLabel",
    "xAxisScale",
    "yAxisScale",
  ],
  Features: [
    "decimalToFraction",
    "allowComplex",
    "recursion",
    "logScales",
    "tone",
    "audio",
    "muted",
    "zoomFit",
    "customRegressions",
    "regressionTemplates",
  ],
  Advanced: [
    "beta3d",
    "advancedStyling",
    "authorFeatures",
    "authorMode",
    "disableLighting",
    "translucentOpacity",
  ],
} as const;

// 値の型を判定
const getOptionType = (key: string, value: unknown): "boolean" | "number" | "string" | "select" => {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (key.includes("ArrowMode")) return "select";
  if (key.includes("Scale")) return "select";
  if (key === "actions") return "select";
  if (key === "reportPosition") return "select";
  if (key === "brailleMode") return "select";
  return "string";
};

// セレクトオプションの選択肢
const getSelectOptions = (key: string) => {
  switch (key) {
    case "xAxisArrowMode":
    case "yAxisArrowMode":
      return ["NONE", "POSITIVE", "BOTH"];
    case "xAxisScale":
    case "yAxisScale":
      return ["linear", "logarithmic"];
    case "actions":
      return ["auto", true, false];
    case "reportPosition":
      return ["coordinates", "percents", "default"];
    case "brailleMode":
      return ["nemeth", "ueb", "none"];
    default:
      return [];
  }
};

export const CalculatorOptionsPanel: React.FC<CalculatorOptionsPanelProps> = ({
  initialOptions,
  onSave,
  onGraphTypeChange,
}) => {
  const [options, setOptions] = useState<GraphingCalculatorOptions & { graphType?: "2d" | "3d" }>(
    initialOptions
  );
  const [selectedCategory, setSelectedCategory] =
    useState<keyof typeof OPTION_CATEGORIES>("UI Components");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // initialOptionsが変化したらoptionsも更新
  useEffect(() => {
    setOptions(initialOptions);
    setHasUnsavedChanges(false);
  }, [initialOptions]);

  const handleGraphTypeChange = (graphType: "2d" | "3d") => {
    setOptions((prev) => ({ ...prev, graphType }));
    setHasUnsavedChanges(true);
    onGraphTypeChange?.(graphType);
  };

  const handleOptionChange = (key: string, value: unknown) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleAddOption = () => {
    if (!selectedOption) return;

    // デフォルト値を設定
    let defaultValue: unknown = false;
    const optionType = getOptionType(selectedOption, defaultValue);

    if (optionType === "number") defaultValue = 1;
    else if (optionType === "string") defaultValue = "";
    else if (optionType === "select") {
      const selectOptions = getSelectOptions(selectedOption);
      defaultValue = selectOptions[0] || false;
    }

    handleOptionChange(selectedOption, defaultValue);
    setSelectedOption("");
  };

  const handleRemoveOption = (key: string) => {
    const newOptions = { ...options };
    delete newOptions[key as keyof typeof newOptions];
    setOptions(newOptions);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setHasUnsavedChanges(false);
    onSave?.(options);
  };

  const renderOptionInput = (key: string, value: unknown) => {
    const optionType = getOptionType(key, value);

    switch (optionType) {
      case "boolean":
        return (
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => handleOptionChange(key, e.target.checked)}
            className="mr-2"
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={Number(value) || 0}
            onChange={(e) => handleOptionChange(key, Number(e.target.value))}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            step="any"
          />
        );

      case "select": {
        const selectOptions = getSelectOptions(key);
        return (
          <select
            value={String(value)}
            onChange={(e) => {
              let newValue: unknown = e.target.value;
              if (newValue === "true") newValue = true;
              else if (newValue === "false") newValue = false;
              handleOptionChange(key, newValue);
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          >
            {selectOptions.map((option) => (
              <option key={String(option)} value={String(option)}>
                {String(option)}
              </option>
            ))}
          </select>
        );
      }

      default:
        return (
          <input
            type="text"
            value={String(value) || ""}
            onChange={(e) => handleOptionChange(key, e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          />
        );
    }
  };

  const currentCategoryOptions = OPTION_CATEGORIES[selectedCategory];
  const availableOptions = currentCategoryOptions.filter((option) => !(option in options));

  return (
    <div className="p-4 space-y-6 max-h-full overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Calculator Options</h2>

      {/* グラフタイプ選択 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">グラフタイプ</h3>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="graphType"
              value="2d"
              checked={options.graphType === "2d"}
              onChange={() => handleGraphTypeChange("2d")}
              className="mr-2"
            />
            <span className="text-sm">2Dグラフ</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="graphType"
              value="3d"
              checked={options.graphType === "3d"}
              onChange={() => handleGraphTypeChange("3d")}
              className="mr-2"
            />
            <span className="text-sm">3Dグラフ</span>
          </label>
        </div>
      </div>

      {/* オプション追加 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">オプション追加</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value as keyof typeof OPTION_CATEGORIES);
              setSelectedOption("");
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          >
            {Object.keys(OPTION_CATEGORIES).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">オプション</label>
          <div className="flex space-x-2">
            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
            >
              <option value="">選択してください</option>
              {availableOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddOption}
              disabled={!selectedOption}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:bg-gray-400"
            >
              追加
            </button>
          </div>
        </div>
      </div>

      {/* 現在のオプション */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">現在のオプション</h3>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {Object.entries(options)
            .filter(([key]) => key !== "graphType")
            .map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700">{key}</div>
                </div>
                <div className="w-32">{renderOptionInput(key, value)}</div>
                <button
                  onClick={() => handleRemoveOption(key)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  削除
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* 保存ボタン */}
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
              setOptions(initialOptions);
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
  );
};
