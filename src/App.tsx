import { useState, useCallback, useEffect } from "react";
import { DesmosGraph } from "./components/DesmosGraph";
import { TimelineControls } from "./components/TimelineControls";
import GraphPreview from "./components/GraphPreview";
import type { StateEvent } from "./types/timeline";
import { UnifiedEventEditPanel } from "./components/UnifiedEventEditPanel";
// ...existing code...
import { VideoExportPanel } from "./components/VideoExportPanel";
import { ResizablePanel } from "./components/ResizablePanel";
import { useTimeline } from "./hooks/useTimeline";
import type { Calculator } from "./types/desmos";
import type { TimelineEvent, VideoExportSettings } from "./types/timeline";
import "./App.css";
import { StateEventEditPanel } from "./components/StateEventEditPanel";

// デバッグモードのフラグ（開発時に true にする）
const DEBUG_MODE = false;

function App() {
  // ファイルメニューのドロップダウン表示状態
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  // calculatorのuseState宣言を先に（重複宣言があれば削除）
  const [calculator, setCalculator] = useState<Calculator | null>(null);
  // useTimelineの呼び出し（重複宣言があれば削除）
  const {
    project,
    currentFrame,
    isPlaying,
    seekTo,
    play,
    pause,
    addEvent,
    insertEvent,
    removeEvent,
    updateEvent,
    updateUnifiedEvent,
    getUnifiedEvent,
    captureCurrentState,
    clearCache,
    getDebugInfo,
    getDebugAtFrame,
    setProject,
    stateManager,
  } = useTimeline(calculator);

  // 保存・読み込みコールバックはuseTimelineの後で定義
  const handleSaveProject = useCallback(() => {
    const dataStr = JSON.stringify(project, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "desmos_project.json";
    a.click();
    URL.revokeObjectURL(url);
    setFileMenuOpen(false);
  }, [project]);

  const handleLoadProject = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target?.result as string);
          setProject(json);
        } catch (err) {
          alert("読み込みに失敗しました: " + err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setFileMenuOpen(false);
  }, [setProject]);

  const fileMenuItems = [
    {
      label: "保存",
      onClick: handleSaveProject,
      className: "hover:bg-blue-50",
    },
    {
      label: "読み込み",
      onClick: handleLoadProject,
      className: "hover:bg-blue-50",
    },
    {
      label: "Stateキャプチャ",
      onClick: () => {
        handleCaptureState();
        setFileMenuOpen(false);
      },
    },
    {
      label: "チェックポイント",
      onClick: () => {
        handleCreateCheckpoint();
        setFileMenuOpen(false);
      },
    },
    {
      label: "キャッシュクリア",
      onClick: () => {
        clearCache();
        setFileMenuOpen(false);
      },
    },
    ...(DEBUG_MODE
      ? [
          {
            label: "Debug",
            onClick: () => {
              handleShowDebugInfo();
              setFileMenuOpen(false);
            },
            className: "hover:bg-gray-100",
          },
          {
            label: "2s Debug",
            onClick: async () => {
              console.log("=== StateManagerデバッグ ===");
              const debugInfo = getDebugInfo();
              console.log("Debug info:", debugInfo);
              try {
                await seekTo(1.9);
                setTimeout(async () => {
                  console.log("State at 1.9s:", calculator?.getExpressions());
                  await seekTo(2.1);
                  setTimeout(() => {
                    console.log("State at 2.1s:", calculator?.getExpressions());
                  }, 100);
                }, 100);
              } catch (e) {
                console.error("Error during state comparison:", e);
              }
              setFileMenuOpen(false);
            },
          },
        ]
      : []),
  ];
  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!fileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const menu = document.getElementById("file-menu-dropdown");
      if (menu && !menu.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [fileMenuOpen]);
  // ページロード時に?showIDs=trueを自動追加
  // グラフ表示/プレビュー表示のタブ状態
  const [graphViewTab, setGraphViewTab] = useState<"graph" | "preview">("graph");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("showIDs")) {
        url.searchParams.append("showIDs", "true");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);
  const [activeTab, setActiveTab] = useState<"state" | "events" | "timeline" | "export">("events");
  const [selectedEvent, setSelectedEvent] = useState<
    TimelineEvent | StateEvent | { type: "initial" } | null
  >(null);
  // フルHD初期値
  const DEFAULT_VIDEO_SETTINGS: VideoExportSettings = {
    durationFrames: 300,
    fps: 30,
    resolution: {
      width: 1920,
      height: 1080,
      preset: "1080p",
    },
    quality: { bitrate: 5000, preset: "standard" },
    format: { container: "mp4", codec: "h264" },
    advanced: {
      targetPixelRatio: 1,
      backgroundColor: "#ffffff",
      antialias: true,
      motionBlur: false,
      frameInterpolation: false,
    },
    metadata: { title: "Desmos Animation", description: "", author: "", tags: [] },
  };
  const [videoSettings, setVideoSettings] = useState<VideoExportSettings>(DEFAULT_VIDEO_SETTINGS);
  const fps = videoSettings?.fps || 30;
  const [graphAspectRatio, setGraphAspectRatio] = useState<number>(16 / 9); // フルHDをデフォルト

  // クエリに showIDs を自動的につける

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

  // --- stateManager取得後に定義 ---
  let handleVideoSettingsChange: (settings: VideoExportSettings) => void = () => {};

  // 動画設定変更ハンドラー（stateManager取得後に定義）
  handleVideoSettingsChange = useCallback(
    (settings: VideoExportSettings) => {
      console.log("App: Video settings changed", settings);
      setVideoSettings(settings);
      adjustGraphAspectRatio(settings);
      if (stateManager) {
        stateManager.videoSettings = settings;
      }
    },
    [adjustGraphAspectRatio, stateManager]
  );

  // イベント時間変更ハンドラー（ドラッグ対応）
  const handleEventTimeChange = useCallback(
    (eventId: string, newTime: number) => {
      const event = project.timeline.find((e) => e.id === eventId);
      if (event) {
        updateEvent(eventId, { ...event, frame: newTime });
        console.log(`Moved event ${eventId} to time ${newTime.toFixed(3)}s`);
      }
    },
    [project.timeline, updateEvent]
  );

  // StateEvent時間変更ハンドラー（ドラッグ対応）
  const handleStateTimeChange = useCallback(
    (stateId: string, newTime: number) => {
      setProject((prev: typeof project) => ({
        ...prev,
        stateEvents: prev.stateEvents
          .map((state: StateEvent) => (state.id === stateId ? { ...state, frame: newTime } : state))
          .sort((a: StateEvent, b: StateEvent) => a.frame - b.frame),
      }));
      console.log(`Moved state ${stateId} to time ${newTime.toFixed(3)}s`);
    },
    [setProject]
  );

  const handleCalculatorReady = useCallback((calc: Calculator) => {
    setCalculator(calc);
  }, []);

  // チェックポイントを作成（機能削除のため空実装）
  const handleCreateCheckpoint = useCallback(() => {
    console.log("Checkpoint functionality not available in V2");
  }, []);

  // 現在のstateをキャプチャ
  const handleCaptureState = useCallback(() => {
    const stateEvent = captureCurrentState(`Manual capture at frame ${currentFrame}`);
    if (stateEvent) {
      console.log("State captured:", stateEvent);
    }
  }, [captureCurrentState, currentFrame]);

  // デバッグ情報を表示（StateManager版）
  const handleShowDebugInfo = useCallback(async () => {
    const debugInfo = getDebugInfo();
    console.log("Debug Info:", debugInfo);

    // 現在フレーム周辺のデバッグ情報
    const frameDebug = await getDebugAtFrame(currentFrame);
    console.log(`Debug at frame ${currentFrame}:`, frameDebug);

    const stateManagerDebug = debugInfo.stateManagerDebug as Record<string, unknown>;

    console.log(
      `=== 基本情報 ===\n` +
        `Current Frame: ${debugInfo.currentFrame}\n` +
        `Last Applied Frame: ${debugInfo.lastAppliedFrame}\n` +
        `Timeline Events: ${debugInfo.timelineEventsCount}\n` +
        `State Events: ${debugInfo.stateEventsCount}\n\n` +
        `=== StateManager情報 ===\n` +
        `StateManager Debug: ${JSON.stringify(stateManagerDebug, null, 2)}\n\n` +
        `=== 現在フレーム (${currentFrame}) の状況 ===\n` +
        `Frame Debug Result: ${frameDebug ? "Success" : "Failed"}\n` +
        (frameDebug ? `Applied Events: ${frameDebug.eventsApplied.length}` : "")
    );
  }, [getDebugInfo, getDebugAtFrame, currentFrame]);

  // 計算済み領域の情報を取得（StateManager用）
  const calculatedRegions: Array<{ start: number; end: number }> = [];

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* メニューバー＋ヘッダー統合 */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-2 h-12 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          {/* メニュー */}
          <div className="flex items-center mr-4">
            <div className="menu-item relative mr-2">
              <button
                className="font-semibold text-gray-700 hover:text-blue-600 focus:outline-none px-2 py-1 rounded"
                onClick={() => setFileMenuOpen((open) => !open)}
                aria-haspopup="true"
                aria-expanded={fileMenuOpen}
              >
                ファイル
              </button>
              {/* ドロップダウンメニュー（クリックで表示） */}
              {fileMenuOpen && (
                <div
                  id="file-menu-dropdown"
                  className="absolute left-0 mt-1 w-44 bg-white border border-gray-200 rounded shadow-lg z-10"
                >
                  {fileMenuItems.map((item, idx) => (
                    <button
                      key={item.label + idx}
                      onClick={item.onClick}
                      className={`w-full text-left px-4 py-2 text-sm text-gray-700 ${item.className} hover:bg-gray-100`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="menu-item relative mr-2">
              <button className="font-semibold text-gray-700 hover:text-blue-600 px-2 py-1 rounded">
                編集
              </button>
            </div>
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
              {/* グラフ/プレビュー切り替えタブ */}
              <div className="h-full flex flex-col">
                <div className="flex border-b border-gray-200 bg-gray-50">
                  <button
                    className={`flex-1 px-2 py-2 text-xs font-medium ${
                      graphViewTab === "graph"
                        ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setGraphViewTab("graph")}
                  >
                    グラフ
                  </button>
                  <button
                    className={`flex-1 px-2 py-2 text-xs font-medium ${
                      graphViewTab === "preview"
                        ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setGraphViewTab("preview")}
                  >
                    プレビュー
                  </button>
                </div>
                <div className="flex-1 h-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                  {graphViewTab === "graph" ? (
                    <DesmosGraph
                      onCalculatorReady={handleCalculatorReady}
                      aspectRatio={graphAspectRatio}
                      className="w-full h-full"
                      currentFrame={currentFrame}
                      stateManager={stateManager}
                      fps={fps}
                    />
                  ) : (
                    // プレビュー画面（拡張性のためラップ）
                    <div className="w-full h-full flex items-center justify-center">
                      {/* 今後字幕や数式などを合成表示する場合はここに追加 */}
                      <GraphPreview
                        computeCalculator={stateManager?.getComputeCalculator() ?? null}
                        currentFrame={currentFrame}
                        stateManager={stateManager}
                        videoSettings={videoSettings ?? undefined}
                        fps={fps}
                      />
                    </div>
                  )}
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
                      State
                    </button>
                    <button
                      onClick={() => setActiveTab("events")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "events"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Event
                    </button>
                    <button
                      onClick={() => setActiveTab("export")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "export"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Export
                    </button>
                    <button
                      onClick={() => setActiveTab("timeline")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "timeline"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Timeline
                    </button>
                  </div>

                  {/* タブコンテンツ */}
                  <div className="p-3 flex-1 overflow-auto min-h-0 relative">
                    {activeTab === "state" && (
                      <div className="h-full flex flex-col">
                        {/* 1. state選択中 */}
                        {selectedEvent &&
                        typeof selectedEvent === "object" &&
                        "id" in selectedEvent ? (
                          <StateEventEditPanel
                            selectedState={
                              project.stateEvents.find((s) => s.id === selectedEvent.id) || null
                            }
                            calculator={calculator}
                            currentTime={currentFrame}
                            onStateUpdate={(state) => {
                              setProject((prev) => ({
                                ...prev,
                                stateEvents: prev.stateEvents.map((s) =>
                                  s.id === state.id ? { ...s, ...state } : s
                                ),
                              }));
                              setSelectedEvent(state);
                            }}
                            onStateDelete={() => {
                              setProject((prev) => ({
                                ...prev,
                                stateEvents: prev.stateEvents.filter(
                                  (s) => s.id !== selectedEvent.id
                                ),
                              }));
                              setSelectedEvent(null);
                            }}
                            onDeselect={() => setSelectedEvent(null)}
                          />
                        ) : (
                          /* 3. 何も選択していない: 新規state挿入 */
                          <StateEventEditPanel
                            selectedState={null}
                            calculator={calculator}
                            currentTime={currentFrame}
                            onStateUpdate={(state) => {
                              setProject((prev) => ({
                                ...prev,
                                stateEvents: [...prev.stateEvents, state],
                              }));
                              setSelectedEvent(state);
                            }}
                            onDeselect={() => setSelectedEvent(null)}
                          />
                        )}
                      </div>
                    )}

                    {activeTab === "events" && (
                      <div className="h-full">
                        <UnifiedEventEditPanel
                          selectedEvent={
                            selectedEvent &&
                            typeof selectedEvent === "object" &&
                            "id" in selectedEvent
                              ? getUnifiedEvent(selectedEvent.id || "")
                              : null
                          }
                          onEventUpdate={updateUnifiedEvent}
                          onEventDelete={() => {
                            if (
                              selectedEvent &&
                              typeof selectedEvent === "object" &&
                              "id" in selectedEvent &&
                              typeof selectedEvent.id === "string"
                            ) {
                              removeEvent(selectedEvent.id);
                              setSelectedEvent(null);
                            }
                          }}
                        />
                      </div>
                    )}

                    {activeTab === "export" && (
                      <div className="h-full">
                        <VideoExportPanel
                          videoSettings={videoSettings}
                          onVideoSettingsChange={handleVideoSettingsChange}
                          currentDuration={project.durationFrames}
                          fps={fps}
                          onSettingsChange={(settings) => {
                            console.log("Video export settings updated:", settings);
                          }}
                          stateManager={stateManager}
                          calculator={stateManager?.getComputeCalculator() || null}
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
                              <div>総フレーム数: {project.durationFrames}フレーム</div>
                              <div>Timeline Events: {project.timeline.length}</div>
                              <div className="text-green-600">
                                State Events: {project.stateEvents.length}
                              </div>
                              <div>現在フレーム: {currentFrame}</div>
                            </div>
                          </div>

                          <div className="p-2 bg-blue-50 rounded">
                            <h3 className="text-xs font-medium text-blue-700 mb-2">StateManager</h3>
                            <div className="text-xs text-blue-600 space-y-1">
                              <div>新しいAPI方式を使用</div>
                              <div>Desmos calculatorで状態計算</div>
                              <div>Timeline Events: {getDebugInfo().timelineEventsCount}</div>
                              <div>State Events: {getDebugInfo().stateEventsCount}</div>
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
          <div
            className="h-full bg-white border-t border-gray-200 flex flex-col"
            style={{ overflow: "visible" }}
          >
            <div className="flex-1 min-h-0" style={{ overflow: "visible" }}>
              <TimelineControls
                currentFrame={currentFrame}
                duration={project.durationFrames}
                fps={fps}
                isPlaying={isPlaying}
                timeline={project.timeline}
                stateEvents={project.stateEvents}
                calculatedRegions={calculatedRegions}
                onSeek={seekTo}
                onPlay={play}
                onPause={pause}
                onInsertEvent={(frame, event) => insertEvent({ ...event, frame })}
                onInsertState={(frame) => captureCurrentState(`State at frame ${frame}`)}
                onEventSelect={setSelectedEvent}
                onStateSelect={(state) => {
                  setSelectedEvent(state);
                }}
                onEventTimeChange={handleEventTimeChange}
                onStateTimeChange={handleStateTimeChange}
                onEventDelete={(eventId) => {
                  if (
                    selectedEvent &&
                    typeof selectedEvent === "object" &&
                    "id" in selectedEvent &&
                    selectedEvent.id === eventId
                  )
                    setSelectedEvent(null);
                  removeEvent(eventId);
                }}
                onEventDuplicate={(event) => {
                  // 新しいIDと時刻+0.1で複製
                  const newEvent = { ...event, id: undefined, frame: event.frame + 1 };
                  insertEvent(newEvent);
                }}
                setActiveTab={setActiveTab}
                selectedEventId={
                  selectedEvent && typeof selectedEvent === "object" && "id" in selectedEvent
                    ? selectedEvent.id
                    : undefined
                }
              />
            </div>
          </div>
        </ResizablePanel>
      </div>
    </div>
  );
}

export default App;
