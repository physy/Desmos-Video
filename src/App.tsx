import { useState, useCallback } from "react";
import { DesmosGraph } from "./components/DesmosGraph";
import { TimelineControls } from "./components/TimelineControls";
import { UnifiedEventEditPanel } from "./components/UnifiedEventEditPanel";
import { useTimeline } from "./hooks/useTimeline";
import type { Calculator } from "./types/desmos";
import type { TimelineEvent } from "./types/timeline";
import "./App.css";

// デバッグモードのフラグ（開発時に true にする）
const DEBUG_MODE = false;

function App() {
  const [calculator, setCalculator] = useState<Calculator | null>(null);
  const [activeTab, setActiveTab] = useState<"state" | "events" | "timeline">("events");
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

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
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Desmos Animation Studio</h1>
          <div className="space-x-2">
            <button
              onClick={addDemoEvents}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              デモイベント追加
            </button>
            <button
              onClick={handleCaptureState}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
              title="現在のstateをキャプチャ"
            >
              Stateキャプチャ
            </button>
            <button
              onClick={handleCreateCheckpoint}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              title="現在時刻でチェックポイント作成"
            >
              チェックポイント
            </button>
            <button
              onClick={updateInitialState}
              className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
              title="現在のstateを初期stateに設定"
            >
              初期state更新
            </button>
            <button
              onClick={clearCache}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              title="キャッシュクリア"
            >
              キャッシュクリア
            </button>
            {DEBUG_MODE && (
              <>
                <button
                  onClick={handleShowDebugInfo}
                  className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
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
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                  title="2sイベント問題をデバッグ"
                >
                  2s Debug
                </button>
              </>
            )}
            <button className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">
              エクスポート
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex">
        {/* Desmosグラフ */}
        <div className="flex-1 p-4">
          <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <DesmosGraph
              onCalculatorReady={handleCalculatorReady}
              options={{
                keypad: false,
                expressions: true,
                settingsMenu: true,
                zoomButtons: true,
                mathBounds: {
                  left: -10,
                  right: 10,
                  top: 10,
                  bottom: -10,
                },
              }}
            />
          </div>
        </div>

        {/* サイドパネル - タブ形式 */}
        <div className="w-80 p-4">
          <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200">
            {/* タブヘッダー */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("state")}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeTab === "state"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                状態
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeTab === "events"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                イベント
              </button>
              <button
                onClick={() => setActiveTab("timeline")}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeTab === "timeline"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                タイムライン
              </button>
            </div>

            {/* タブコンテンツ */}
            <div className="p-4 h-full overflow-auto">
              {activeTab === "state" && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">
                    現在の状態 ({currentTime.toFixed(3)}s)
                  </h2>

                  {calculator && (
                    <div className="space-y-4">
                      {/* 状態のJSON表示 */}
                      <div>
                        <h3 className="text-md font-medium text-gray-800 mb-2">完全な状態</h3>
                        <div className="bg-gray-50 border rounded p-3 text-xs font-mono overflow-auto max-h-60">
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
                        <h3 className="text-md font-medium text-gray-800 mb-2">式一覧</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {calculator.getExpressions().map((expr, index) => (
                            <div
                              key={expr.id || index}
                              className={`p-2 border rounded text-sm ${
                                expr.hidden
                                  ? "border-gray-300 bg-gray-50 text-gray-500"
                                  : "border-green-200 bg-green-50 text-green-700"
                              }`}
                            >
                              <div className="font-mono">{expr.latex}</div>
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
                        className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        現在の状態をキャプチャ
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "events" && (
                <UnifiedEventEditPanel
                  selectedEvent={selectedEvent ? getUnifiedEvent(selectedEvent.id || "") : null}
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
              )}

              {activeTab === "timeline" && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">タイムライン詳細</h2>

                  <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">プロジェクト情報</h3>
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

                    <div className="p-3 bg-blue-50 rounded">
                      <h3 className="text-sm font-medium text-blue-700 mb-2">計算システム</h3>
                      <div className="text-xs text-blue-600 space-y-1">
                        <div>計算済み領域: {getDebugInfo().cacheInfo.calculatedRegions}個</div>
                        <div>イベントキャッシュ: {getDebugInfo().cacheInfo.eventCacheSize}個</div>
                        <div>重要時刻数: {getDebugInfo().criticalTimes.length}個</div>
                      </div>
                    </div>

                    <div className="p-3 bg-green-50 rounded">
                      <h3 className="text-sm font-medium text-green-700 mb-2">使用方法</h3>
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
      </div>

      {/* タイムラインコントロール */}
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
  );
}

export default App;
