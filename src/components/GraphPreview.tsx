import React, { useEffect, useState } from "react";
import type { Calculator } from "../types/desmos";

interface GraphPreviewProps {
  computeCalculator: Calculator | null;
  currentTime: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stateManager: any; // StateManager型
  videoSettings?: {
    resolution: { width: number; height: number };
    bounds?: { left: number; right: number; top: number; bottom: number };
  };
}

const GraphPreview: React.FC<GraphPreviewProps> = ({
  computeCalculator,
  currentTime,
  stateManager,
  videoSettings,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const generatePreview = async () => {
      if (!computeCalculator || !stateManager) return;

      // まずキャッシュ済みスクリーンショットを取得
      const cachedScreenshot = stateManager.getScreenshotAtTime(currentTime);
      if (cachedScreenshot) {
        console.log("Using cached screenshot");
        setImageUrl(cachedScreenshot);
        setLoading(false);
        return;
      }

      setLoading(true);
      // 指定時刻の状態を計算用calculatorに適用
      await stateManager.applyStateAtTime(currentTime, computeCalculator);

      // exportパネルの解像度・範囲を取得
      const width = videoSettings?.resolution?.width ?? 640;
      const height = videoSettings?.resolution?.height ?? 360;
      const bounds = videoSettings?.bounds;

      // 範囲指定があれば反映
      if (bounds) {
        computeCalculator.setMathBounds(bounds);
      }

      // asyncScreenshotで確実に描画後の画像を取得
      if (typeof computeCalculator.asyncScreenshot === "function") {
        computeCalculator.asyncScreenshot({ width, height }, (url: string) => {
          if (!cancelled) {
            setImageUrl(url);
            // キャッシュ保存
            if (typeof stateManager.setScreenshotAtTime === "function") {
              stateManager.setScreenshotAtTime(currentTime, url);
            }
          }
          setLoading(false);
        });
      } else {
        // fallback: 通常のscreenshot
        const result = computeCalculator.screenshot({ width, height });
        if (typeof result === "string") {
          if (!cancelled) {
            setImageUrl(result);
            if (typeof stateManager.setScreenshotAtTime === "function") {
              stateManager.setScreenshotAtTime(currentTime, result);
            }
          }
        } else if (typeof result === "undefined") {
          computeCalculator.screenshot({ width, height }, (url: string) => {
            if (!cancelled) {
              setImageUrl(url);
              if (typeof stateManager.setScreenshotAtTime === "function") {
                stateManager.setScreenshotAtTime(currentTime, url);
              }
            }
          });
        }
        setLoading(false);
      }
    };
    generatePreview();
    return () => {
      cancelled = true;
    };
  }, [computeCalculator, currentTime, stateManager, videoSettings]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      {!imageUrl ? (
        <span>プレビューを生成中...</span>
      ) : (
        <img src={imageUrl} alt="Graph Preview" style={{ maxWidth: "100%", maxHeight: "100%" }} />
      )}
    </div>
  );
};

export default GraphPreview;
