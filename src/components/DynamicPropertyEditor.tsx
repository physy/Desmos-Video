import React from "react";
import { PROPERTY_CONFIGS, type PropertyConfig } from "../utils/propertyConfigs";

interface PropertyEditorProps {
  properties: Record<string, unknown>;
  onPropertyChange: (key: string, value: unknown) => void;
  onPropertyAdd: (key: string) => void;
  onPropertyRemove: (key: string) => void;
}

// 単一プロパティエディタのレンダリング
const renderPropertyEditor = (
  propertyKey: string,
  config: PropertyConfig,
  currentValue: unknown,
  onPropertyChange: (key: string, value: unknown) => void
) => {
  switch (config.type) {
    case "boolean":
      return (
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={Boolean(currentValue)}
            onChange={(e) => onPropertyChange(propertyKey, e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">{config.label}</span>
        </label>
      );

    case "string":
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{config.label}</label>
          <input
            type="text"
            value={String(currentValue || "")}
            placeholder={config.placeholder}
            onChange={(e) => onPropertyChange(propertyKey, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{config.label}</label>
          <input
            type="number"
            value={Number(currentValue || 0)}
            min={config.min}
            max={config.max}
            step={config.step}
            onChange={(e) => onPropertyChange(propertyKey, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      );

    case "range":
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {config.label}:{" "}
            {Number(currentValue || 0).toFixed(config.step && config.step < 1 ? 1 : 0)}
          </label>
          <input
            type="range"
            value={Number(currentValue || 0)}
            min={config.min}
            max={config.max}
            step={config.step}
            onChange={(e) => onPropertyChange(propertyKey, Number(e.target.value))}
            className="w-full"
          />
        </div>
      );

    case "color":
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{config.label}</label>
          <input
            type="color"
            value={String(currentValue || "#000000")}
            onChange={(e) => onPropertyChange(propertyKey, e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-md"
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{config.label}</label>
          <select
            value={String(currentValue || "")}
            onChange={(e) => onPropertyChange(propertyKey, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {config.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{config.label}</label>
          <textarea
            value={String(currentValue || "")}
            placeholder={config.placeholder}
            onChange={(e) => onPropertyChange(propertyKey, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
          />
        </div>
      );

    case "object":
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">{config.label}</label>
          <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
            {config.objectFields &&
              Object.entries(config.objectFields).map(([fieldKey, fieldConfig]) => {
                const objectValue = (currentValue as Record<string, unknown>) || {};
                const fieldValue = objectValue[fieldKey] ?? fieldConfig.defaultValue;

                return (
                  <div key={fieldKey} className="mb-2 last:mb-0">
                    {renderPropertyEditor(
                      `${propertyKey}.${fieldKey}`,
                      { ...fieldConfig, label: fieldKey },
                      fieldValue,
                      (_, value) => {
                        const newObjectValue = { ...objectValue, [fieldKey]: value };
                        onPropertyChange(propertyKey, newObjectValue);
                      }
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      );

    case "array": {
      const arrayValue = (currentValue as unknown[]) || [];
      return (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700">{config.label}</label>
            <button
              onClick={() => {
                const newItem =
                  config.arrayItemType === "object"
                    ? Object.fromEntries(
                        Object.entries(config.arrayItemFields || {}).map(([key, field]) => [
                          key,
                          field.defaultValue,
                        ])
                      )
                    : "";
                onPropertyChange(propertyKey, [...arrayValue, newItem]);
              }}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              項目追加
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {arrayValue.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-md p-2 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-500">項目 {index + 1}</span>
                  <button
                    onClick={() => {
                      const newArray = arrayValue.filter((_, i) => i !== index);
                      onPropertyChange(propertyKey, newArray);
                    }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    削除
                  </button>
                </div>
                {config.arrayItemType === "string" ? (
                  <input
                    type="text"
                    value={String(item)}
                    onChange={(e) => {
                      const newArray = [...arrayValue];
                      newArray[index] = e.target.value;
                      onPropertyChange(propertyKey, newArray);
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                ) : config.arrayItemType === "object" && config.arrayItemFields ? (
                  <div className="space-y-1">
                    {Object.entries(config.arrayItemFields).map(([fieldKey, fieldConfig]) => {
                      const itemValue = (item as Record<string, unknown>) || {};
                      const fieldValue = itemValue[fieldKey] ?? fieldConfig.defaultValue;

                      return (
                        <div key={fieldKey}>
                          {renderPropertyEditor(
                            `${propertyKey}[${index}].${fieldKey}`,
                            { ...fieldConfig, label: fieldKey },
                            fieldValue,
                            (_, value) => {
                              const newArray = [...arrayValue];
                              newArray[index] = { ...itemValue, [fieldKey]: value };
                              onPropertyChange(propertyKey, newArray);
                            }
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {arrayValue.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-2">項目がありません</div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
};

export const DynamicPropertyEditor: React.FC<PropertyEditorProps> = ({
  properties,
  onPropertyChange,
  onPropertyAdd,
  onPropertyRemove,
}) => {
  const currentProperties = Object.keys(properties).filter(
    (key) => properties[key] !== undefined && properties[key] !== null
  );

  const availableProperties = Object.keys(PROPERTY_CONFIGS).filter(
    (key) => !currentProperties.includes(key)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">プロパティ</h3>
        {availableProperties.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onPropertyAdd(e.target.value);
                e.target.value = "";
              }
            }}
            className="text-xs px-2 py-1 border border-gray-300 rounded"
          >
            <option value="">プロパティを追加</option>
            {availableProperties.map((key: string) => (
              <option key={key} value={key}>
                {PROPERTY_CONFIGS[key].label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {currentProperties.map((propertyKey) => {
          const config = PROPERTY_CONFIGS[propertyKey];
          if (!config) return null;

          const currentValue = properties[propertyKey] ?? config.defaultValue;

          return (
            <div key={propertyKey} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">{propertyKey}</span>
                <button
                  onClick={() => onPropertyRemove(propertyKey)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  削除
                </button>
              </div>
              {renderPropertyEditor(propertyKey, config, currentValue, onPropertyChange)}
            </div>
          );
        })}

        {currentProperties.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-4">
            <p>プロパティが設定されていません</p>
            <p className="text-xs mt-1">上のドロップダウンからプロパティを追加してください</p>
          </div>
        )}
      </div>
    </div>
  );
};
