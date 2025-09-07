import React, { useEffect, useState, useRef } from "react";
import type { Calculator } from "../types/desmos";
import type { FormulaElement, SubtitleElement } from "../types/formula";
import { OverlayRenderer } from "./OverlayRenderer";

interface GraphPreviewProps {
  computeCalculator: Calculator | null;
  currentFrame: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stateManager: any; // StateManager型
  videoSettings?: {
    resolution: { width: number; height: number };
    bounds?: { left: number; right: number; top: number; bottom: number };
  };
  fps?: number;
  // 数式・字幕データ
  formulas?: FormulaElement[];
  subtitles?: SubtitleElement[];
  // 選択状態
  selectedElementId?: string | null;
  selectedElementType?: "formula" | "subtitle" | null;
  // インタラクティブ操作用のコールバック
  onElementSelect?: (id: string | null, type: "formula" | "subtitle" | null) => void;
  onFormulaUpdate?: (id: string, updates: Partial<FormulaElement>) => void;
  onSubtitleUpdate?: (id: string, updates: Partial<SubtitleElement>) => void;
}

const GraphPreview: React.FC<GraphPreviewProps> = ({
  computeCalculator,
  currentFrame,
  stateManager,
  videoSettings,
  fps = 30,
  formulas = [],
  subtitles = [],
  selectedElementId = null,
  selectedElementType = null,
  onElementSelect,
  onFormulaUpdate,
  onSubtitleUpdate,
}) => {
  // frame→秒変換関数
  const frameToSeconds = (frame: number) => (fps ? frame / fps : frame / 30);
  // 例: 現在フレームの秒数表示（UIに追加する場合）
  // <div>現在: {currentFrame}フレーム ({frameToSeconds(currentFrame).toFixed(2)}秒)</div>
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [graphBounds, setGraphBounds] = useState<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null>(null);

  // graphBoundsの初期化とリセット処理
  useEffect(() => {
    if (!computeCalculator) return;

    // グラフの境界を取得する関数
    const updateGraphBounds = () => {
      // StateManagerのvideoSettingsを優先して取得
      const effectiveSettings = stateManager?.videoSettings ?? videoSettings;
      const bounds = effectiveSettings?.bounds;

      if (bounds) {
        console.log("Setting graph bounds from settings:", bounds);
        setGraphBounds(bounds);
      } else {
        // 現在の境界を取得
        const currentBounds = computeCalculator.graphpaperBounds?.mathCoordinates;
        if (currentBounds) {
          console.log("Setting graph bounds from calculator:", currentBounds);
          setGraphBounds(currentBounds);
        } else {
          // フォールバック: デフォルト境界
          const defaultBounds = { left: -10, right: 10, top: 10, bottom: -10 };
          console.log("Setting default graph bounds:", defaultBounds);
          setGraphBounds(defaultBounds);
        }
      }
    };

    // 初期設定
    updateGraphBounds();

    // calculatorの状態変化を監視（タブ切り替え後の復旧用）
    const interval = setInterval(() => {
      const currentBounds = computeCalculator.graphpaperBounds?.mathCoordinates;
      // graphBoundsが未設定、または無効な場合は更新
      setGraphBounds((prev) => {
        if (!prev || (prev.left === 0 && prev.right === 0)) {
          updateGraphBounds();
          return prev; // updateGraphBounds内でsetGraphBoundsが呼ばれるのでここではprevを返す
        } else if (
          currentBounds &&
          (Math.abs(currentBounds.left - prev.left) > 0.01 ||
            Math.abs(currentBounds.right - prev.right) > 0.01)
        ) {
          // 境界が変更された場合も更新
          updateGraphBounds();
          return prev;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [computeCalculator, stateManager, videoSettings]);

  // コンテナサイズ監視（ResizeObserver使用）
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
        console.log("Container size updated:", { width, height });
      }
    };

    let resizeObserver: ResizeObserver | null = null;

    if (containerRef.current) {
      updateSize();

      // ResizeObserverでコンテナサイズの変更を監視
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setContainerSize({ width, height });
          console.log("ResizeObserver detected size change:", { width, height });
        }
      });

      resizeObserver.observe(containerRef.current);
    }

    // フォールバック：windowリサイズイベント
    window.addEventListener("resize", updateSize);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const generatePreview = async () => {
      if (!computeCalculator || !stateManager) return;

      // fpsを使ったframe→秒変換例（必要ならUIやキャッシュキー等に利用）
      // const seconds = currentFrame / fps;

      // まずキャッシュ済みスクリーンショットを取得
      const cachedScreenshot = await stateManager.getScreenshotAtFrame(currentFrame);
      if (cachedScreenshot) {
        console.log("Using cached screenshot");
        setImageUrl(cachedScreenshot);
        setLoading(false);
        return;
      }

      setLoading(true);
      // 指定時刻の状態を計算用calculatorに適用
      await stateManager.applyStateAtFrame(currentFrame, computeCalculator, false);

      // StateManagerのvideoSettingsを優先して取得
      const effectiveSettings = stateManager?.videoSettings ?? videoSettings;
      const pixelRatio = effectiveSettings?.advanced?.targetPixelRatio ?? 1;
      const width = Math.round((effectiveSettings?.resolution?.width ?? 1920) * pixelRatio);
      const height = Math.round((effectiveSettings?.resolution?.height ?? 1080) * pixelRatio);
      const bounds = effectiveSettings?.bounds;

      // 範囲指定があれば反映
      if (bounds) {
        computeCalculator.setMathBounds(bounds);
        console.log("Applied bounds to calculator:", bounds);
        // graphBoundsを確実に設定
        setGraphBounds(bounds);
      } else {
        // 現在の境界を取得してgraphBoundsを更新
        const currentBounds = computeCalculator.graphpaperBounds?.mathCoordinates;
        if (currentBounds) {
          console.log("Setting graphBounds from current calculator bounds:", currentBounds);
          setGraphBounds(currentBounds);
        }
      }

      // スクリーンショット専用calculatorでスクリーンショット取得
      const screenshotCalculator = stateManager?.getScreenshotCalculator
        ? stateManager.getScreenshotCalculator()
        : null;

      if (!screenshotCalculator || typeof screenshotCalculator.asyncScreenshot !== "function") {
        console.error("Screenshot calculator not available or asyncScreenshot method missing");
        setLoading(false);
        return;
      }

      try {
        const screenshotUrl = await stateManager.getScreenshotWithDedicatedCalculator(
          await stateManager.getStateAtFrame(currentFrame, false),
          width,
          height,
          pixelRatio
        );
        if (!cancelled) {
          setImageUrl(screenshotUrl);
          // キャッシュ保存
          if (typeof stateManager.setScreenshotAtFrame === "function") {
            stateManager.setScreenshotAtFrame(currentFrame, screenshotUrl);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Error taking screenshot with dedicated calculator:", error);
        setLoading(false);
      }
    };
    generatePreview();
    return () => {
      cancelled = true;
    };
  }, [computeCalculator, currentFrame, stateManager, videoSettings, fps]);

  // エクスポート解像度とコンテナサイズの比率計算
  const effectiveSettings = stateManager?.videoSettings ?? videoSettings;
  const exportWidth = effectiveSettings?.resolution?.width ?? 1920;
  const exportHeight = effectiveSettings?.resolution?.height ?? 1080;

  // コンテナ内での実際の表示サイズを計算（object-fit: contain の効果）
  const containerAspect = containerSize.width / containerSize.height;
  const exportAspect = exportWidth / exportHeight;

  let displayWidth, displayHeight;
  if (containerAspect > exportAspect) {
    // コンテナが横長の場合、高さに合わせる
    displayHeight = containerSize.height;
    displayWidth = displayHeight * exportAspect;
  } else {
    // コンテナが縦長の場合、幅に合わせる
    displayWidth = containerSize.width;
    displayHeight = displayWidth / exportAspect;
  }

  const scale = displayWidth / exportWidth;
  const offsetX = (containerSize.width - displayWidth) / 2;
  const offsetY = (containerSize.height - displayHeight) / 2;

  // デバッグ用：スケール計算の情報をログ出力
  console.log("GraphPreview scale calculation:", {
    containerSize,
    exportSize: { width: exportWidth, height: exportHeight },
    displaySize: { width: displayWidth, height: displayHeight },
    scale,
    offset: { x: offsetX, y: offsetY },
  });

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-gray-100 relative"
    >
      {!imageUrl ? (
        <span>プレビューを生成中...</span>
      ) : (
        <>
          <img
            src={imageUrl}
            alt="Graph Preview"
            className="w-full h-full object-contain bg-white touch-none no-drag"
          />
          {/* 数式・字幕オーバーレイ */}
          <OverlayRenderer
            formulas={formulas}
            subtitles={subtitles}
            currentFrame={currentFrame}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            exportWidth={exportWidth}
            exportHeight={exportHeight}
            displayScale={scale}
            displayOffsetX={offsetX}
            displayOffsetY={offsetY}
            className="absolute inset-0"
            debug={false}
            selectedElementId={selectedElementId}
            selectedElementType={selectedElementType}
            onElementSelect={onElementSelect}
            onFormulaUpdate={onFormulaUpdate}
            onSubtitleUpdate={onSubtitleUpdate}
          />
        </>
      )}
    </div>
  );
};

export default GraphPreview;
