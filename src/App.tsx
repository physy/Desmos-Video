import React, { useState, useCallback } from "react";
import { DesmosGraph } from "./components/DesmosGraph";
import { TimelineControls } from "./components/TimelineControls";
import { UnifiedEventEditPanel } from "./components/UnifiedEventEditPanel";
import { GraphConfigPanel } from "./components/GraphConfigPanel";
import { VideoExportPanel } from "./components/VideoExportPanel";
import { ResizablePanel } from "./components/ResizablePanel";
import { useTimeline } from "./hooks/useTimeline";
import type { Calculator } from "./types/desmos";
import type { TimelineEvent, VideoExportSettings } from "./types/timeline";
import "./App.css";

// デバッグモードのフラグ（開発時に true にする）
const DEBUG_MODE = false;

function App() {
  const [calculator, setCalculator] = useState<Calculator | null>(null);
  const [activeTab, setActiveTab] = useState<"state" | "events" | "timeline" | "graph" | "export">(
    "events"
  );
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [videoSettings, setVideoSettings] = useState<VideoExportSettings | null>(null);
  const [graphAspectRatio, setGraphAspectRatio] = useState<number>(16 / 9); // フルHDをデフォルト

  // 動画解像度に基づいてグラフの縦横比を調整する関数
  const adjustGraphAspectRatio = useCallback(
    (settings: VideoExportSettings) => {
      const { width, height } = settings.resolution;
      const aspectRatio = width / height;

      console.log("App: Adjusting graph aspect ratio", { width, height, aspectRatio });

      // DOM要素のアスペクト比を設定
      setGraphAspectRatio(aspectRatio);

      // 数学的な境界も調整（calculator が利用可能な場合）
      if (calculator) {
        setTimeout(() => {
          const currentBounds = calculator.graphpaperBounds?.mathCoordinates;
          if (!currentBounds) return;

          // 現在の中心点を保持
          const centerX = (currentBounds.left + currentBounds.right) / 2;
          const centerY = (currentBounds.top + currentBounds.bottom) / 2;

          // 現在の範囲の大きさを取得
          const currentWidth = currentBounds.right - currentBounds.left;
          const currentHeight = currentBounds.top - currentBounds.bottom;

          // 新しい範囲を計算（アスペクト比に合わせて調整）
          let newWidth, newHeight;

          if (aspectRatio > 1) {
            // 横長（16:9など）
            newHeight = currentHeight;
            newWidth = newHeight * aspectRatio;
          } else if (aspectRatio < 1) {
            // 縦長（9:16など）
            newWidth = currentWidth;
            newHeight = newWidth / aspectRatio;
          } else {
            // 正方形（1:1）
            const maxDimension = Math.max(currentWidth, currentHeight);
            newWidth = maxDimension;
            newHeight = maxDimension;
          }

          // 新しい境界を設定
          const newBounds = {
            left: centerX - newWidth / 2,
            right: centerX + newWidth / 2,
            top: centerY + newHeight / 2,
            bottom: centerY - newHeight / 2,
          };

          console.log("App: Setting new math bounds", newBounds);
          calculator.setMathBounds(newBounds);
        }, 200); // Desmosのリサイズ処理を待つ
      }
    },
    [calculator]
  );

  // 動画設定変更ハンドラー
  const handleVideoSettingsChange = useCallback(
    (settings: VideoExportSettings) => {
      console.log("App: Video settings changed", settings);
      setVideoSettings(settings);
      adjustGraphAspectRatio(settings);
    },
    [adjustGraphAspectRatio]
  );

  const {
    project,
    currentTime,
    isPlaying,
    seekTo,
    play,
    pause,
    addEvent,
    insertEvent,
    removeEvent,
    updateUnifiedEvent,
    getUnifiedEvent,
    captureCurrentState,
    createCheckpoint,
    updateInitialState,
    clearCache,
    getDebugInfo,
    getDebugAtTime,
  } = useTimeline(calculator);

  const handleCalculatorReady = useCallback(
    (calc: Calculator) => {
      setCalculator(calc);

      // デモ用の初期設定
      calc.setExpression({
        id: "demo1",
        latex: "y = \\sin(x)",
        color: "#2563eb",
      });

      calc.setExpression({
        id: "demo2",
        latex: "y = \\cos(x)",
        color: "#dc2626",
        hidden: true,
      });

      // 初期stateを設定（calculator準備後）
      setTimeout(() => {
        updateInitialState();
      }, 100);
    },
    [updateInitialState]
  );

  const addDemoEvents = useCallback(() => {
    // デモイベントを追加
    addEvent({
      time: 5,
      action: "setMathBounds",
      args: { left: -5, right: 5, top: 3, bottom: -3 },
    });

    addEvent({
      time: 7,
      action: "setExpression",
      args: {
        id: "demo3",
        latex: "y = x^2",
        color: "#16a34a",
      },
    });
  }, [addEvent]);

  // チェックポイントを作成
  const handleCreateCheckpoint = useCallback(() => {
    createCheckpoint(currentTime);
  }, [createCheckpoint, currentTime]);

  // 現在のstateをキャプチャ
  const handleCaptureState = useCallback(() => {
    const stateEvent = captureCurrentState(`Manual capture at ${currentTime.toFixed(1)}s`);
    if (stateEvent) {
      console.log("State captured:", stateEvent);
    }
  }, [captureCurrentState, currentTime]);

  // デバッグ情報を表示（新システム版）
  const handleShowDebugInfo = useCallback(() => {
    const debugInfo = getDebugInfo();
    console.log("Debug Info:", debugInfo);

    // 詳細なデバッグ情報
    console.log("Detailed Debug:", debugInfo.detailedDebug);

    // 現在時刻周辺のデバッグ情報
    const timeDebug = getDebugAtTime(currentTime);
    console.log(`Debug at ${currentTime}s:`, timeDebug);

    console.log(
      `=== 基本情報 ===\n` +
        `Current Time: ${debugInfo.currentTime.toFixed(1)}s\n` +
        `Last Applied: ${debugInfo.lastAppliedTime.toFixed(1)}s\n` +
        `Max Calculated: ${debugInfo.maxCalculatedTime.toFixed(1)}s\n\n` +
        `=== 計算済み領域 ===\n` +
        `Regions Count: ${debugInfo.detailedDebug.calculatedRegions.length}\n` +
        debugInfo.detailedDebug.calculatedRegions
          .map((r, i) => `${i + 1}. ${r.start}s-${r.end}s`)
          .join("\n") +
        "\n\n" +
        `=== イベント ===\n` +
        `Timeline Events: ${debugInfo.detailedDebug.timelineEvents.length}\n` +
        debugInfo.detailedDebug.timelineEvents.map((e) => `${e.time}s: ${e.action}`).join("\n") +
        "\n\n" +
        `=== 現在時刻 (${currentTime}s) の状況 ===\n` +
        `Found Region: ${
          timeDebug.foundRegion
            ? `${timeDebug.foundRegion.start}s-${timeDebug.foundRegion.end}s`
            : "なし"
        }\n` +
        `Nearby Events: ${timeDebug.nearbyEvents
          .map((e) => `${e.time}s(${e.action})`)
          .join(", ")}\n` +
        `Cached States: ${timeDebug.cachedStates.join(", ")}`
    );
  }, [getDebugInfo, getDebugAtTime, currentTime]);

  // 計算済み領域の情報を取得（新システム用）
  const calculatedRegions = getDebugInfo().calculatedRegions;

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 p-3 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Desmos Animation Studio</h1>
          <div className="space-x-2">
            <button
              onClick={addDemoEvents}
              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              デモイベント追加
            </button>
            <button
              onClick={handleCaptureState}
              className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
              title="現在のstateをキャプチャ"
            >
              Stateキャプチャ
            </button>
            <button
              onClick={handleCreateCheckpoint}
              className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
              title="現在時刻でチェックポイント作成"
            >
              チェックポイント
            </button>
            <button
              onClick={updateInitialState}
              className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
              title="現在のstateを初期stateに設定"
            >
              初期state更新
            </button>
            <button
              onClick={clearCache}
              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              title="キャッシュクリア"
            >
              キャッシュクリア
            </button>
            {DEBUG_MODE && (
              <>
                <button
                  onClick={handleShowDebugInfo}
                  className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                  title="デバッグ情報表示"
                >
                  Debug
                </button>
                <button
                  onClick={() => {
                    console.log("=== 2s問題デバッグ ===");
                    [1.9, 2.0, 2.1].forEach((time) => {
                      const debug = getDebugAtTime(time);
                      console.log(`Time ${time}s:`, debug);
                    });

                    // 計算済み領域の詳細を確認
                    const regions = getDebugInfo().detailedDebug.calculatedRegions;
                    console.log("All regions:", regions);

                    // 2s前後で状態を比較
                    try {
                      seekTo(1.9);
                      setTimeout(() => {
                        console.log("State at 1.9s:", calculator?.getExpressions());
                        seekTo(2.1);
                        setTimeout(() => {
                          console.log("State at 2.1s:", calculator?.getExpressions());
                        }, 100);
                      }, 100);
                    } catch (e) {
                      console.error("Error during state comparison:", e);
                    }
                  }}
                  className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                  title="2sイベント問題をデバッグ"
                >
                  2s Debug
                </button>
              </>
            )}
            <button className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
              エクスポート
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツエリア - 縦分割 */}
      <div className="flex-1 min-h-0">
        <ResizablePanel
          direction="vertical"
          initialSizes={[70, 30]}
          minSizes={[40, 20]}
          maxSizes={[85, 60]}
          className="h-full"
        >
          {/* 上部: グラフとサイドパネル */}
          <div className="h-full">
            <ResizablePanel
              direction="horizontal"
              initialSizes={[70, 30]}
              minSizes={[50, 25]}
              maxSizes={[80, 50]}
              className="h-full"
            >
              {/* Desmosグラフ */}
              <div className="h-full">
                <div className="h-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                  <DesmosGraph
                    onCalculatorReady={handleCalculatorReady}
                    aspectRatio={graphAspectRatio}
                    className="w-full h-full"
                  />
                </div>
              </div>

              {/* サイドパネル - タブ形式 */}
              <div className="h-full">
                <div className="h-full bg-white  border border-gray-200 flex flex-col">
                  {/* タブヘッダー */}
                  <div className="flex border-b border-gray-200 flex-shrink-0">
                    <button
                      onClick={() => setActiveTab("state")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "state"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      状態
                    </button>
                    <button
                      onClick={() => setActiveTab("events")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "events"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      イベント
                    </button>
                    <button
                      onClick={() => setActiveTab("graph")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "graph"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      グラフ
                    </button>
                    <button
                      onClick={() => setActiveTab("export")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "export"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      エクスポート
                    </button>
                    <button
                      onClick={() => setActiveTab("timeline")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "timeline"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      タイムライン
                    </button>
                  </div>

                  {/* タブコンテンツ */}
                  <div className="p-3 flex-1 overflow-auto min-h-0">
                    {activeTab === "state" && (
                      <div className="h-full">
                        <h2 className="text-sm font-semibold mb-3">
                          現在の状態 ({currentTime.toFixed(3)}s)
                        </h2>

                        {calculator && (
                          <div className="space-y-3 h-full">
                            {/* 状態のJSON表示 */}
                            <div>
                              <h3 className="text-xs font-medium text-gray-800 mb-2">完全な状態</h3>
                              <div className="bg-gray-50 border rounded p-2 text-xs font-mono overflow-auto max-h-32">
                                <pre>
                                  {JSON.stringify(
                                    {
                                      expressions: calculator.getExpressions(),
                                      bounds: calculator.graphpaperBounds?.mathCoordinates,
                                      viewport: calculator.graphpaperBounds?.pixelCoordinates,
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            </div>

                            {/* 現在の式 */}
                            <div>
                              <h3 className="text-xs font-medium text-gray-800 mb-2">式一覧</h3>
                              <div className="space-y-2 max-h-32 overflow-y-auto">
                                {calculator.getExpressions().map((expr, index) => (
                                  <div
                                    key={expr.id || index}
                                    className={`p-2 border rounded text-xs ${
                                      expr.hidden
                                        ? "border-gray-300 bg-gray-50 text-gray-500"
                                        : "border-green-200 bg-green-50 text-green-700"
                                    }`}
                                  >
                                    <div className="font-mono text-xs">{expr.latex}</div>
                                    <div className="text-xs mt-1">
                                      ID: {expr.id} | {expr.hidden ? "非表示" : "表示中"}
                                      {expr.color && ` | ${expr.color}`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Stateキャプチャボタン */}
                            <button
                              onClick={() =>
                                captureCurrentState(`Manual capture at ${currentTime.toFixed(1)}s`)
                              }
                              className="w-full px-3 py-2 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                            >
                              現在の状態をキャプチャ
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "events" && (
                      <div className="h-full">
                        <UnifiedEventEditPanel
                          selectedEvent={
                            selectedEvent ? getUnifiedEvent(selectedEvent.id || "") : null
                          }
                          onEventUpdate={updateUnifiedEvent}
                          onEventDelete={() => {
                            if (selectedEvent?.id) {
                              removeEvent(selectedEvent.id);
                              setSelectedEvent(null);
                            }
                          }}
                          availableExpressions={project.initialState.expressions.list
                            .filter((expr) => expr.id && expr.latex)
                            .map((expr) => ({
                              id: expr.id!,
                              latex: expr.latex!,
                              color: expr.color,
                            }))}
                          getCurrentExpressions={() =>
                            calculator
                              ? calculator.getExpressions().filter((expr) => expr.id && expr.latex)
                              : []
                          }
                        />
                      </div>
                    )}

                    {activeTab === "graph" && (
                      <div className="h-full">
                        <GraphConfigPanel
                          calculator={calculator}
                          onConfigUpdate={(config) => {
                            console.log("Graph config updated:", config);
                          }}
                        />
                      </div>
                    )}

                    {activeTab === "export" && (
                      <div className="h-full">
                        <VideoExportPanel
                          videoSettings={videoSettings}
                          onVideoSettingsChange={handleVideoSettingsChange}
                          currentDuration={project.duration}
                          onSettingsChange={(settings) => {
                            console.log("Video export settings updated:", settings);
                          }}
                          onExportStart={(settings) => {
                            console.log("Starting video export with settings:", settings);
                            // TODO: 実際のエクスポート処理を実装
                          }}
                        />
                      </div>
                    )}

                    {activeTab === "timeline" && (
                      <div className="h-full">
                        <h2 className="text-sm font-semibold mb-3">タイムライン詳細</h2>

                        <div className="space-y-3">
                          <div className="p-2 bg-gray-50 rounded">
                            <h3 className="text-xs font-medium text-gray-700 mb-2">
                              プロジェクト情報
                            </h3>
                            <div className="text-xs text-gray-500 space-y-1">
                              <div>総時間: {project.duration}秒</div>
                              <div>Timeline Events: {project.timeline.length}</div>
                              <div className="text-green-600">
                                State Events: {project.stateEvents.length}
                              </div>
                              <div>現在時刻: {currentTime.toFixed(3)}秒</div>
                              <div className="text-orange-600">
                                最大計算済み時刻: {getDebugInfo().maxCalculatedTime.toFixed(1)}秒
                              </div>
                              <div>初期式数: {project.initialState.expressions.list.length}</div>
                            </div>
                          </div>

                          <div className="p-2 bg-blue-50 rounded">
                            <h3 className="text-xs font-medium text-blue-700 mb-2">計算システム</h3>
                            <div className="text-xs text-blue-600 space-y-1">
                              <div>
                                計算済み領域: {getDebugInfo().cacheInfo.calculatedRegions}個
                              </div>
                              <div>
                                イベントキャッシュ: {getDebugInfo().cacheInfo.eventCacheSize}個
                              </div>
                              <div>重要時刻数: {getDebugInfo().criticalTimes.length}個</div>
                            </div>
                          </div>

                          <div className="p-2 bg-green-50 rounded">
                            <h3 className="text-xs font-medium text-green-700 mb-2">使用方法</h3>
                            <div className="text-xs text-green-600 space-y-1">
                              <div>• タイムライン上でダブルクリックでイベント挿入</div>
                              <div>• イベントをドラッグして時刻変更（予定）</div>
                              <div>• 変数アニメーションで時間軸での値変化</div>
                              <div>• プロパティ変更でExpressionの外観変更</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </div>

          {/* 下部: タイムラインコントロール */}
          <div className="h-full bg-white border-t border-gray-200 flex flex-col">
            <div className="flex-1 min-h-0">
              <TimelineControls
                currentTime={currentTime}
                duration={project.duration}
                isPlaying={isPlaying}
                timeline={project.timeline}
                stateEvents={project.stateEvents}
                calculatedRegions={calculatedRegions}
                onSeek={seekTo}
                onPlay={play}
                onPause={pause}
                onInsertEvent={(time, event) => insertEvent({ ...event, time })}
                onInsertState={(time) => captureCurrentState(`State at ${time.toFixed(1)}s`)}
                onEventSelect={setSelectedEvent}
                selectedEventId={selectedEvent?.id}
              />
            </div>
          </div>
        </ResizablePanel>
      </div>
    </div>
  );
}

export default App;
