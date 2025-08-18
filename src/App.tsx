import { useState, useCallback } from "react";
import { DesmosGraph } from "./components/DesmosGraph";
import { TimelineControls } from "./components/TimelineControls";
import { useTimeline } from "./hooks/useTimeline";
import type { Calculator } from "./types/desmos";
import "./App.css";

function App() {
  const [calculator, setCalculator] = useState<Calculator | null>(null);
  const [activeTab, setActiveTab] = useState<"state" | "events" | "timeline">("state");
  const {
    project,
    currentTime,
    isPlaying,
    seekTo,
    play,
    pause,
    addEvent,
    insertEvent,
    updateEvent,
    removeEvent,
    captureCurrentState,
    createCheckpoint,
    updateInitialState,
    clearCache,
    getDebugInfo,
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
      time: 2,
      action: "setHidden",
      args: { id: "demo1", hidden: true },
    });

    addEvent({
      time: 2.5,
      action: "setHidden",
      args: { id: "demo2", hidden: false },
    });

    addEvent({
      time: 5,
      action: "setMathBounds",
      args: { left: -5, right: 5, top: 3, bottom: -3 },
    });

    addEvent({
      time: 7,
      action: "addExpression",
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
    alert(
      `Calculated Regions: ${debugInfo.cacheInfo.calculatedRegions}\n` +
        `Event Cache Size: ${debugInfo.cacheInfo.eventCacheSize}\n` +
        `Regions: ${debugInfo.cacheInfo.calculatedRegionDetails.join(", ")}\n` +
        `Critical Times: ${debugInfo.criticalTimes.join(", ")}\n` +
        `Max Calculated Time: ${debugInfo.maxCalculatedTime.toFixed(1)}s\n` +
        `State Events: ${debugInfo.stateEventsCount}\n` +
        `Current Time: ${debugInfo.currentTime.toFixed(1)}s\n` +
        `Last Applied: ${debugInfo.lastAppliedTime.toFixed(1)}s`
    );
  }, [getDebugInfo]);

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
            <button
              onClick={handleShowDebugInfo}
              className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              title="デバッグ情報表示"
            >
              Debug
            </button>
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
                <div>
                  <h2 className="text-lg font-semibold mb-4">イベント管理</h2>

                  {/* イベント作成 */}
                  <div className="mb-6 space-y-3">
                    <h3 className="text-md font-medium text-gray-800">新規イベント作成</h3>

                    {/* 基本イベント */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          insertEvent({
                            time: currentTime,
                            action: "setHidden",
                            args: { id: "demo1", hidden: true },
                          });
                        }}
                        className="px-3 py-2 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        非表示
                      </button>
                      <button
                        onClick={() => {
                          insertEvent({
                            time: currentTime,
                            action: "setHidden",
                            args: { id: "demo1", hidden: false },
                          });
                        }}
                        className="px-3 py-2 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        表示
                      </button>
                    </div>

                    {/* 式追加 */}
                    <button
                      onClick={() => {
                        const latex = prompt("式を入力してください:", "y = x^2");
                        if (latex) {
                          insertEvent({
                            time: currentTime,
                            action: "addExpression",
                            args: {
                              id: `expr_${Date.now()}`,
                              latex,
                              color: "#2563eb",
                            },
                          });
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      式を追加
                    </button>

                    {/* 変数アニメーション */}
                    <button
                      onClick={() => {
                        const varName = prompt("変数名を入力してください:", "a");
                        const startVal = prompt("開始値:", "1");
                        const endVal = prompt("終了値:", "5");
                        const duration = prompt("継続時間（秒）:", "2");

                        if (varName && startVal && endVal && duration) {
                          // アニメーション開始イベント
                          insertEvent({
                            time: currentTime,
                            action: "startAnimation",
                            args: {
                              variable: varName,
                              startValue: parseFloat(startVal),
                              endValue: parseFloat(endVal),
                              duration: parseFloat(duration),
                            },
                          });

                          // アニメーション終了イベント
                          insertEvent({
                            time: currentTime + parseFloat(duration),
                            action: "endAnimation",
                            args: {
                              variable: varName,
                              value: parseFloat(endVal),
                            },
                          });
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                      変数アニメーション
                    </button>

                    {/* プロパティ変更 */}
                    <button
                      onClick={() => {
                        const id = prompt("Expression ID:", "demo1");
                        const property = prompt(
                          "プロパティ (color, lineStyle, pointStyle, etc.):",
                          "color"
                        );
                        const value = prompt("値:", "#ff0000");

                        if (id && property && value) {
                          insertEvent({
                            time: currentTime,
                            action: "updateExpression",
                            args: {
                              id,
                              [property]: value,
                            },
                          });
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
                    >
                      プロパティ変更
                    </button>
                  </div>

                  {/* Timeline Events */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-md font-medium text-gray-800">Timeline Events</h3>
                      <span className="text-xs text-gray-500">{project.timeline.length}件</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {project.timeline.length === 0 ? (
                        <p className="text-gray-500 text-sm">
                          イベントがありません。上のボタンまたはタイムライン上でダブルクリックしてください。
                        </p>
                      ) : (
                        project.timeline.map((event, index) => (
                          <div
                            key={event.id || index}
                            className="p-2 border border-blue-200 rounded bg-blue-50 hover:bg-blue-100"
                          >
                            <div className="flex justify-between items-start">
                              <div
                                className="cursor-pointer flex-1"
                                onClick={() => seekTo(event.time)}
                                title="クリックでその時刻にジャンプ"
                              >
                                <div className="text-sm font-medium text-blue-700">
                                  {event.time.toFixed(2)}s: {event.action}
                                </div>
                                <div className="text-xs text-blue-600 mt-1 font-mono">
                                  {JSON.stringify(event.args)}
                                </div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newTime = prompt(
                                      `新しい時刻を入力してください (現在: ${event.time}s):`,
                                      event.time.toString()
                                    );
                                    if (newTime && !isNaN(parseFloat(newTime))) {
                                      updateEvent(event.id!, { time: parseFloat(newTime) });
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                  title="時刻を編集"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      confirm(
                                        `イベント "${event.action}" (${event.time}s) を削除しますか？`
                                      )
                                    ) {
                                      removeEvent(event.id!);
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                  title="削除"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* State Events */}
                  <div className="mb-6">
                    <h3 className="text-md font-medium text-gray-800 mb-2">State Events</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {project.stateEvents.length === 0 ? (
                        <p className="text-gray-500 text-sm">
                          State Eventsがありません。「状態」タブでキャプチャしてください。
                        </p>
                      ) : (
                        project.stateEvents.map((stateEvent, index) => (
                          <div
                            key={stateEvent.id || index}
                            className="p-2 border border-green-200 rounded bg-green-50 hover:bg-green-100 cursor-pointer"
                            onClick={() => seekTo(stateEvent.time)}
                            title="クリックでその時刻にジャンプ"
                          >
                            <div className="text-sm font-medium text-green-700">
                              {stateEvent.time.toFixed(2)}s: State
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                              {stateEvent.description || "Captured state"}
                            </div>
                            <div className="text-xs text-green-500 mt-1">
                              {stateEvent.state.expressions.length} expressions
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
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
                        <div>初期式数: {project.initialState.expressions.length}</div>
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
      />
    </div>
  );
}

export default App;
