import React, { useState, useEffect } from "react";
import type { VideoExportSettings } from "../types/timeline";

export interface VideoExportPanelProps {
  videoSettings?: VideoExportSettings | null;
  onVideoSettingsChange?: (settings: VideoExportSettings) => void;
  currentDuration: number;
  fps?: number;
  onSettingsChange?: (settings: VideoExportSettings) => void;
  onExportStart?: (settings: VideoExportSettings) => void;
}

// プリセット解像度
const RESOLUTION_PRESETS = {
  "720p": { width: 1280, height: 720, label: "HD 720p (16:9)" },
  "1080p": { width: 1920, height: 1080, label: "Full HD 1080p (16:9)" },
  "1440p": { width: 2560, height: 1440, label: "QHD 1440p (16:9)" },
  "4k": { width: 3840, height: 2160, label: "4K UHD (16:9)" },
  square: { width: 1080, height: 1080, label: "Square 1080x1080" },
  vertical: { width: 1080, height: 1920, label: "Vertical 1080x1920 (9:16)" },
  custom: { width: 1920, height: 1080, label: "カスタム" },
} as const;

// 品質プリセット
const QUALITY_PRESETS = {
  draft: { label: "ドラフト", bitrate: 2000, description: "低品質・高速" },
  standard: { label: "スタンダード", bitrate: 5000, description: "標準品質" },
  high: { label: "ハイ", bitrate: 10000, description: "高品質" },
  ultra: { label: "ウルトラ", bitrate: 20000, description: "最高品質・低速" },
} as const;

export const VideoExportPanel: React.FC<VideoExportPanelProps> = ({
  videoSettings,
  onVideoSettingsChange,
  currentDuration,
  fps = 30,
  onSettingsChange,
  onExportStart,
}) => {
  // frame→秒変換関数
  const frameToSeconds = (frame: number) => (fps ? frame / fps : frame / 30);
  const [settings, setSettings] = useState<VideoExportSettings>(() => {
    // 外部から渡された設定があればそれを使用、なければデフォルト
    return (
      videoSettings || {
        durationFrames: currentDuration * fps,
        fps,
        resolution: {
          width: 1920,
          height: 1080,
          preset: "1080p",
        },
        quality: {
          bitrate: 5000,
          preset: "standard",
        },
        format: {
          container: "mp4",
          codec: "h264",
        },
        advanced: {
          targetPixelRatio: 2,
          backgroundColor: "#ffffff",
          antialias: true,
          motionBlur: false,
          frameInterpolation: false,
        },
        metadata: {
          title: "Desmos Animation",
          description: "",
          author: "",
          tags: [],
        },
      }
    );
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // プロジェクト時間の変更を反映
  useEffect(() => {
    setSettings((prev) => ({ ...prev, durationFrames: currentDuration * (fps || 30), fps }));
  }, [currentDuration, fps]);

  // 外部からの設定変更を反映
  useEffect(() => {
    if (videoSettings) {
      setSettings(videoSettings);
    }
  }, [videoSettings]);

  // 設定変更ハンドラー
  const handleSettingsChange = (updates: Partial<VideoExportSettings>) => {
    const newSettings = { ...settings, ...updates };
    console.log("VideoExportPanel: Settings changed", { updates, newSettings });
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
    onVideoSettingsChange?.(newSettings); // 親コンポーネントに通知
  };

  // 解像度プリセット変更
  const handleResolutionPresetChange = (preset: keyof typeof RESOLUTION_PRESETS) => {
    const resolution = RESOLUTION_PRESETS[preset];
    console.log("VideoExportPanel: Resolution preset changed", { preset, resolution });
    handleSettingsChange({
      resolution: {
        ...settings.resolution,
        preset,
        width: resolution.width,
        height: resolution.height,
      },
    });
  };

  // 品質プリセット変更
  const handleQualityPresetChange = (preset: keyof typeof QUALITY_PRESETS) => {
    const quality = QUALITY_PRESETS[preset];
    handleSettingsChange({
      quality: {
        ...settings.quality,
        preset,
        bitrate: quality.bitrate,
      },
    });
  };

  // エクスポート開始
  const handleExportStart = () => {
    setIsExporting(true);
    setExportProgress(0);
    onExportStart?.(settings);

    // デモ用の進捗シミュレーション
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  // 推定ファイルサイズ計算
  const estimateFileSize = () => {
    const { durationFrames, quality } = settings;
    const { bitrate = 5000 } = quality;
    const duration = frameToSeconds(durationFrames);
    const sizeInMB = (bitrate * duration) / 8 / 1024; // kbps to MB
    return sizeInMB.toFixed(1);
  };

  // 推定レンダリング時間計算
  const estimateRenderTime = () => {
    const { durationFrames } = settings;
    const totalFrames = durationFrames;
    const estimatedSeconds = totalFrames * 0.5; // フレームあたり0.5秒と仮定
    return Math.ceil(estimatedSeconds / 60); // 分単位
  };

  return (
    <div className="p-4 space-y-6 max-h-full overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold mb-4">動画エクスポート設定</h2>
      </div>

      {/* 基本設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">基本設定</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">動画の長さ (秒)</label>
            <input
              type="number"
              value={settings.durationFrames}
              onChange={(e) => handleSettingsChange({ durationFrames: parseFloat(e.target.value) })}
              min="0.1"
              step="0.1"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              フレームレート (fps)
            </label>
            <select
              value={settings.fps}
              onChange={(e) => handleSettingsChange({ fps: parseInt(e.target.value) })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={24}>24 fps (映画)</option>
              <option value={30}>30 fps (標準)</option>
              <option value={60}>60 fps (滑らか)</option>
              <option value={120}>120 fps (超滑らか)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 解像度設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">解像度</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">プリセット</label>
          <select
            value={settings.resolution.preset}
            onChange={(e) =>
              handleResolutionPresetChange(e.target.value as keyof typeof RESOLUTION_PRESETS)
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Object.entries(RESOLUTION_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">幅 (px)</label>
            <input
              type="number"
              value={settings.resolution.width}
              onChange={(e) =>
                handleSettingsChange({
                  resolution: {
                    ...settings.resolution,
                    width: parseInt(e.target.value),
                    preset: "custom",
                  },
                })
              }
              min="100"
              step="1"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">高さ (px)</label>
            <input
              type="number"
              value={settings.resolution.height}
              onChange={(e) =>
                handleSettingsChange({
                  resolution: {
                    ...settings.resolution,
                    height: parseInt(e.target.value),
                    preset: "custom",
                  },
                })
              }
              min="100"
              step="1"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="text-xs text-gray-500">
          アスペクト比: {(settings.resolution.width / settings.resolution.height).toFixed(2)}
        </div>
      </div>

      {/* 品質設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">品質</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">品質プリセット</label>
          <select
            value={settings.quality.preset}
            onChange={(e) =>
              handleQualityPresetChange(e.target.value as keyof typeof QUALITY_PRESETS)
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label} - {preset.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            ビットレート: {settings.quality.bitrate} kbps
          </label>
          <input
            type="range"
            min="1000"
            max="50000"
            step="1000"
            value={settings.quality.bitrate}
            onChange={(e) =>
              handleSettingsChange({
                quality: {
                  ...settings.quality,
                  bitrate: parseInt(e.target.value),
                },
              })
            }
            className="w-full"
          />
        </div>
      </div>

      {/* フォーマット設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">フォーマット</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">コンテナ</label>
            <select
              value={settings.format.container}
              onChange={(e) =>
                handleSettingsChange({
                  format: {
                    ...settings.format,
                    container: e.target.value as "mp4" | "webm" | "gif",
                  },
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="mp4">MP4 (推奨)</option>
              <option value="webm">WebM</option>
              <option value="gif">GIF</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">コーデック</label>
            <select
              value={settings.format.codec}
              onChange={(e) =>
                handleSettingsChange({
                  format: {
                    ...settings.format,
                    codec: e.target.value as "h264" | "h265" | "vp8" | "vp9",
                  },
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="h264">H.264 (互換性)</option>
              <option value="h265">H.265 (高効率)</option>
              <option value="vp8">VP8</option>
              <option value="vp9">VP9</option>
            </select>
          </div>
        </div>
      </div>

      {/* 詳細設定 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">詳細設定</h3>

        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              ピクセル比: {settings.advanced.targetPixelRatio}x
            </label>
            <input
              type="range"
              min="1"
              max="4"
              step="0.5"
              value={settings.advanced.targetPixelRatio}
              onChange={(e) =>
                handleSettingsChange({
                  advanced: {
                    ...settings.advanced,
                    targetPixelRatio: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full"
            />
            <div className="text-xs text-gray-500">高い値ほど鮮明だが処理時間増加</div>
          </div>

          <div className="space-y-1">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.advanced.antialias}
                onChange={(e) =>
                  handleSettingsChange({
                    advanced: {
                      ...settings.advanced,
                      antialias: e.target.checked,
                    },
                  })
                }
                className="mr-2"
              />
              <span className="text-sm">アンチエイリアス</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.advanced.motionBlur}
                onChange={(e) =>
                  handleSettingsChange({
                    advanced: {
                      ...settings.advanced,
                      motionBlur: e.target.checked,
                    },
                  })
                }
                className="mr-2"
              />
              <span className="text-sm">モーションブラー（予定）</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.advanced.frameInterpolation}
                onChange={(e) =>
                  handleSettingsChange({
                    advanced: {
                      ...settings.advanced,
                      frameInterpolation: e.target.checked,
                    },
                  })
                }
                className="mr-2"
              />
              <span className="text-sm">フレーム補間（予定）</span>
            </label>
          </div>
        </div>
      </div>

      {/* メタデータ */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 border-b pb-1">メタデータ</h3>

        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
            <input
              type="text"
              value={settings.metadata.title}
              onChange={(e) =>
                handleSettingsChange({
                  metadata: {
                    ...settings.metadata,
                    title: e.target.value,
                  },
                })
              }
              placeholder="Desmos Animation"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">説明</label>
            <textarea
              value={settings.metadata.description}
              onChange={(e) =>
                handleSettingsChange({
                  metadata: {
                    ...settings.metadata,
                    description: e.target.value,
                  },
                })
              }
              placeholder="動画の説明..."
              rows={2}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 推定情報 */}
      <div className="space-y-2 pt-4 border-t">
        <h3 className="text-xs font-medium text-gray-500">推定情報</h3>
        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded space-y-1">
          <div>総フレーム数: {settings.durationFrames} フレーム</div>
          <div>推定ファイルサイズ: {estimateFileSize()} MB</div>
          <div>推定レンダリング時間: 約 {estimateRenderTime()} 分</div>
          <div>
            解像度: {settings.resolution.width} × {settings.resolution.height}
          </div>
        </div>
      </div>

      {/* エクスポートボタン */}
      <div className="space-y-3 pt-4 border-t">
        <button
          onClick={handleExportStart}
          disabled={isExporting}
          className={`w-full px-4 py-3 text-white font-medium rounded ${
            isExporting ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isExporting ? "動画をエクスポート中..." : "動画をエクスポート"}
        </button>

        {isExporting && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <div className="text-xs text-center text-gray-600">
              {exportProgress.toFixed(0)}% 完了
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
