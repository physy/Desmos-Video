import { useState, useCallback, useEffect } from "react";
import { DesmosGraph } from "./components/DesmosGraph";
import { TimelineControls } from "./components/TimelineControls";
import GraphPreview from "./components/GraphPreview";
import type { StateEvent } from "./types/timeline";
import { UnifiedEventEditPanel } from "./components/UnifiedEventEditPanel";
import { VideoExportPanel } from "./components/VideoExportPanel";
import { GraphSettingsPanel, type GraphSettings } from "./components/GraphSettingsPanel";
import { ResizablePanel } from "./components/ResizablePanel";
import { FormulaEditPanel } from "./components/FormulaEditPanel";
import { useTimeline } from "./hooks/useTimeline";
import { useFormulaManager } from "./hooks/useFormulaManager";
import { useProjectHistory } from "./hooks/useProjectHistory";
import type { Calculator, GraphingCalculatorOptions } from "./types/desmos";
import type { TimelineEvent, VideoExportSettings, AnimationProject } from "./types/timeline";
import type { FormulaElement, SubtitleElement } from "./types/formula";
import "./App.css";
import { StateEventEditPanel } from "./components/StateEventEditPanel";

// デバッグモードのフラグ（開発時に true にする）
const DEBUG_MODE = false;

function App() {
  // ファイルメニューのドロップダウン表示状態
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  // calculatorのuseState宣言を先に（重複宣言があれば削除）
  const [calculator, setCalculator] = useState<Calculator | null>(null);
  // GraphSettingsの状態
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
  const [graphSettings, setGraphSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);

  // CalculatorOptionsの状態（初期値は最小限に）
  const [calculatorOptions, setCalculatorOptions] = useState<
    GraphingCalculatorOptions & { graphType: "2d" | "3d" }
  >({
    graphType: "2d",
  });

  // VideoExportSettingsの状態（宣言を前方へ移動）
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

  // 初期プロジェクト定義
  const INITIAL_PROJECT: AnimationProject = {
    timeline: [],
    stateEvents: [],
    continuousEvents: [],
    durationFrames: 300,
    fps: 30,
    graphSettings: DEFAULT_GRAPH_SETTINGS,
    videoExportSettings: DEFAULT_VIDEO_SETTINGS,
    calculatorOptions: {
      graphType: "2d",
    },
    formulas: [],
    subtitles: [],
  };

  // 数式・字幕管理（プロジェクトから独立）
  const {
    formulas,
    subtitles,
    addFormula,
    addSubtitle,
    updateElement,
    updateElementTime,
    deleteElement,
    duplicateElement: duplicateFormulaElement,
    clearAll: clearAllFormulas,
    exportData: exportFormulaData,
    importData: importFormulaData,
  } = useFormulaManager({
    initialFormulas: [],
    initialSubtitles: [],
  });

  // useTimelineの呼び出し（先に定義）
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
    selectedStateId,
    setSelectedStateId,
    selectedEventId,
    setSelectedEventId,
  } = useTimeline(calculator, calculatorOptions);

  // プロジェクト変更時のコールバック（Undo/Redo/Load時に呼ばれる）
  const handleProjectChange = useCallback(
    (newProject: AnimationProject) => {
      console.log("プロジェクト変更コールバック実行:", newProject);

      // 各状態を抽出
      const {
        graphSettings: hGraphSettings,
        videoExportSettings: hVideoSettings,
        calculatorOptions: hCalculatorOptions,
        formulas: hFormulas,
        subtitles: hSubtitles,
        ...timelineProject
      } = newProject;

      // useTimelineのプロジェクトを更新
      setProject(timelineProject);

      // その他の状態も更新
      if (hGraphSettings) {
        setGraphSettings(hGraphSettings);
      }
      if (hVideoSettings) {
        setVideoSettings(hVideoSettings);
      }
      if (hCalculatorOptions && hCalculatorOptions.graphType) {
        setCalculatorOptions({
          ...hCalculatorOptions,
          graphType: hCalculatorOptions.graphType,
        });
      }
      if (hFormulas || hSubtitles) {
        importFormulaData({
          formulas: hFormulas || [],
          subtitles: hSubtitles || [],
        });
      }
    },
    [setProject, importFormulaData]
  );

  // 履歴管理フック（コールバック付き）
  const {
    project: historyProject,
    canUndo,
    canRedo,
    undo,
    redo,
    updateProject: updateProjectHistory,
    applyProject,
    saveToStorage,
    loadFromStorage,
    clearHistory,
  } = useProjectHistory(INITIAL_PROJECT, handleProjectChange);

  // 初期化時にローカルストレージからプロジェクトを復元（一度のみ）
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!hasInitialized) {
      const savedProject = loadFromStorage();
      if (savedProject) {
        console.log("初期化時にプロジェクトを復元:", savedProject);
        // 各状態を直接設定（履歴に追加しない）
        const {
          graphSettings: hGraphSettings,
          videoExportSettings: hVideoSettings,
          calculatorOptions: hCalculatorOptions,
          formulas: hFormulas,
          subtitles: hSubtitles,
          ...timelineProject
        } = savedProject;

        setProject(timelineProject);

        if (hGraphSettings) {
          setGraphSettings(hGraphSettings);
        }
        if (hVideoSettings) {
          setVideoSettings(hVideoSettings);
        }
        if (hCalculatorOptions && hCalculatorOptions.graphType) {
          setCalculatorOptions({
            ...hCalculatorOptions,
            graphType: hCalculatorOptions.graphType,
          });
        }
        if (hFormulas || hSubtitles) {
          importFormulaData({
            formulas: hFormulas || [],
            subtitles: hSubtitles || [],
          });
        }
      }
      setHasInitialized(true);
    }
  }, [hasInitialized, loadFromStorage, setProject, importFormulaData]);

  // プロジェクトが変更されたときに履歴を更新（初期化時は除く）
  useEffect(() => {
    if (hasInitialized) {
      const fullProject: AnimationProject = {
        ...project,
        graphSettings,
        videoExportSettings: videoSettings,
        calculatorOptions,
        formulas,
        subtitles,
      };
      updateProjectHistory(fullProject);
    }
  }, [
    hasInitialized,
    project,
    graphSettings,
    videoSettings,
    calculatorOptions,
    formulas,
    subtitles,
    updateProjectHistory,
  ]);

  // プロジェクト読み込み時のみ数式・字幕データを同期
  const [lastLoadedProjectId, setLastLoadedProjectId] = useState<string | null>(null);
  useEffect(() => {
    const currentProjectId = JSON.stringify({
      formulas: project.formulas,
      subtitles: project.subtitles,
    });

    if (lastLoadedProjectId !== currentProjectId && (project.formulas || project.subtitles)) {
      importFormulaData({
        formulas: project.formulas || [],
        subtitles: project.subtitles || [],
      });
      setLastLoadedProjectId(currentProjectId);
    }
  }, [project.formulas, project.subtitles, importFormulaData, lastLoadedProjectId]);

  // 数式・字幕の選択状態
  const [selectedFormulaElementId, setSelectedFormulaElementId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementType, setSelectedElementType] = useState<"formula" | "subtitle" | null>(
    null
  );

  // 要素選択ハンドラー
  const handleElementSelect = useCallback(
    (id: string | null, type: "formula" | "subtitle" | null) => {
      setSelectedFormulaElementId(id);
      setSelectedElementId(id);
      setSelectedElementType(type);
      // 数式・字幕がクリックされたらformulaタブを開く
      if (id && type) {
        setActiveTab("formula");
      }
    },
    []
  );

  // 数式更新ハンドラー
  const handleFormulaUpdate = useCallback(
    (id: string, updates: Partial<FormulaElement>) => {
      const currentFormula = formulas.find((f) => f.id === id);
      if (currentFormula) {
        updateElement({ ...currentFormula, ...updates });
      }
    },
    [formulas, updateElement]
  );

  // 字幕更新ハンドラー
  const handleSubtitleUpdate = useCallback(
    (id: string, updates: Partial<SubtitleElement>) => {
      const currentSubtitle = subtitles.find((s) => s.id === id);
      if (currentSubtitle) {
        updateElement({ ...currentSubtitle, ...updates });
      }
    },
    [subtitles, updateElement]
  );

  // 数式・字幕データの変更をプロジェクトに反映しない（保存時のみ同期）

  // ...existing code...

  // videoSettings宣言の後に保存・読み込みコールバックを定義
  // Calculator再作成のハンドラー
  const handleGraphTypeChange = useCallback(
    (newGraphType: "2d" | "3d") => {
      setCalculatorOptions((prev) => ({ ...prev, graphType: newGraphType }));

      // 既存のcalculatorを破棄
      if (calculator) {
        calculator.destroy();
      }

      // DesmosGraphコンポーネントに再作成を委譲
      setCalculator(null);
    },
    [calculator]
  );

  const handleSaveProject = useCallback(() => {
    // 現在の状態をプロジェクトとして保存
    const saveObj: AnimationProject = {
      ...project,
      graphSettings,
      videoExportSettings: videoSettings,
      calculatorOptions,
      formulas,
      subtitles,
    };

    // ローカルストレージにも保存
    try {
      saveToStorage();
    } catch (error) {
      console.warn("ローカルストレージへの保存に失敗:", error);
    }

    // ファイルとしてダウンロード
    const dataStr = JSON.stringify(saveObj, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoSettings.metadata.title || "desmos_project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFileMenuOpen(false);
  }, [
    project,
    graphSettings,
    videoSettings,
    calculatorOptions,
    formulas,
    subtitles,
    saveToStorage,
  ]);

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
          const json: AnimationProject = JSON.parse(ev.target?.result as string);

          // 履歴管理を通してプロジェクトを適用
          applyProject(json);

          // 履歴をクリア（新しいプロジェクトとして扱う）
          clearHistory();

          console.log("プロジェクトを読み込みました:", json);
        } catch (err) {
          alert("読み込みに失敗しました: " + err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setFileMenuOpen(false);
  }, [applyProject, clearHistory]);

  const fileMenuItems: Array<
    | { label: string; onClick: () => void; className?: string; disabled?: boolean }
    | { separator: true }
  > = [
    {
      label: "元に戻す (Ctrl+Z)",
      onClick: () => {
        undo();
        setFileMenuOpen(false);
      },
      className: "hover:bg-gray-50",
      disabled: !canUndo,
    },
    {
      label: "やり直し (Ctrl+Y)",
      onClick: () => {
        redo();
        setFileMenuOpen(false);
      },
      className: "hover:bg-gray-50",
      disabled: !canRedo,
    },
    { separator: true }, // セパレーター
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
  // グラフ表示/プレビュー表示のタブ状態
  const [graphViewTab, setGraphViewTab] = useState<"graph" | "preview">("graph");
  const [activeTab, setActiveTab] = useState<
    "state" | "events" | "timeline" | "export" | "graph" | "formula"
  >("events");
  // 選択状態はuseTimelineで一元管理
  // selectedStateId, setSelectedStateId, selectedEventId, setSelectedEventIdを利用
  // フルHD初期値
  // ...existing code...
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
      // 動画長（durationFrames）が変更されたらタイムライン長も更新
      setProject((prev) => ({
        ...prev,
        durationFrames: settings.durationFrames,
      }));
    },
    [adjustGraphAspectRatio, stateManager, setProject, setVideoSettings]
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
      if (newTime < 0) {
        setProject((prev: typeof project) => ({
          ...prev,
          stateEvents: prev.stateEvents.filter((state: StateEvent) => state.id !== stateId),
        }));
        console.log(`Deleted state ${stateId}`);
      } else {
        setProject((prev: typeof project) => ({
          ...prev,
          stateEvents: prev.stateEvents
            .map((state: StateEvent) =>
              state.id === stateId ? { ...state, frame: newTime } : state
            )
            .sort((a: StateEvent, b: StateEvent) => a.frame - b.frame),
        }));
        console.log(`Moved state ${stateId} to time ${newTime.toFixed(3)}s`);
      }
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
                  {fileMenuItems.map((item, idx) => {
                    if ("separator" in item && item.separator) {
                      return (
                        <div key={`separator-${idx}`} className="border-t border-gray-200 my-1" />
                      );
                    }
                    const menuItem = item as {
                      label: string;
                      onClick: () => void;
                      className?: string;
                      disabled?: boolean;
                    };
                    return (
                      <button
                        key={menuItem.label + idx}
                        onClick={menuItem.onClick}
                        disabled={menuItem.disabled}
                        className={`w-full text-left px-4 py-2 text-sm ${
                          menuItem.disabled
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-gray-700 hover:bg-gray-100"
                        } ${menuItem.className || ""}`}
                      >
                        {menuItem.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="menu-item relative mr-2">
              <button className="font-semibold text-gray-700 hover:text-blue-600 px-2 py-1 rounded">
                ヘルプ
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
              onResize={() => {
                // DesmosGraphのresizeを呼ぶ
                if (
                  graphViewTab === "graph" &&
                  typeof window !== "undefined" &&
                  window.Desmos &&
                  calculator
                ) {
                  try {
                    calculator.resize();
                  } catch (e) {
                    console.warn("Failed to resize calculator", e);
                  }
                }
              }}
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
                      calculatorOptions={calculatorOptions}
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
                        formulas={formulas}
                        subtitles={subtitles}
                        selectedElementId={selectedElementId}
                        selectedElementType={selectedElementType}
                        onElementSelect={handleElementSelect}
                        onFormulaUpdate={handleFormulaUpdate}
                        onSubtitleUpdate={handleSubtitleUpdate}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* サイドパネル - タブ形式 */}
              <div className="h-full">
                <div className="h-full bg-white  border border-gray-200 flex flex-col">
                  {/* タブヘッダー */}
                  <div className="flex border-b border-gray-200 flex-shrink-0 overflow-x-auto scrollbar-hidden">
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
                      onClick={() => setActiveTab("graph")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "graph"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Graph
                    </button>
                    <button
                      onClick={() => setActiveTab("formula")}
                      className={`flex-1 px-2 py-2 text-xs font-medium ${
                        activeTab === "formula"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Formula
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
                        {selectedStateId ? (
                          <StateEventEditPanel
                            selectedState={
                              project.stateEvents.find((s) => s.id === selectedStateId) || null
                            }
                            calculator={calculator}
                            currentTime={currentFrame}
                            onStateUpdate={(state) => {
                              setProject((prev) => ({
                                ...prev,
                                stateEvents: prev.stateEvents.some((s) => s.id === state.id)
                                  ? prev.stateEvents.map((s) =>
                                      s.id === state.id ? { ...s, ...state } : s
                                    )
                                  : [...prev.stateEvents, state],
                              }));
                              setSelectedStateId(state.id);
                            }}
                            onStateDelete={() => {
                              if (selectedStateId) {
                                setProject((prev) => ({
                                  ...prev,
                                  stateEvents: prev.stateEvents.filter(
                                    (s) => s.id !== selectedStateId
                                  ),
                                }));
                                setSelectedStateId(null);
                              }
                            }}
                            onDeselect={() => setSelectedStateId(null)}
                            selectedStateId={selectedStateId}
                            setSelectedStateId={setSelectedStateId}
                          />
                        ) : (
                          <StateEventEditPanel
                            selectedState={null}
                            calculator={calculator}
                            currentTime={currentFrame}
                            onStateUpdate={(state) => {
                              setProject((prev) => ({
                                ...prev,
                                stateEvents: [...prev.stateEvents, state],
                              }));
                              setSelectedStateId(state.id);
                            }}
                            onStateDelete={undefined}
                            onDeselect={() => setSelectedStateId(null)}
                            selectedStateId={selectedStateId}
                            setSelectedStateId={setSelectedStateId}
                          />
                        )}
                      </div>
                    )}

                    {activeTab === "events" && (
                      <div className="h-full">
                        <UnifiedEventEditPanel
                          selectedEvent={selectedEventId ? getUnifiedEvent(selectedEventId) : null}
                          onEventUpdate={updateUnifiedEvent}
                          onEventDelete={() => {
                            if (selectedEventId) {
                              removeEvent(selectedEventId);
                              setSelectedEventId(null);
                            }
                          }}
                        />
                      </div>
                    )}

                    {activeTab === "graph" && (
                      <div className="h-full">
                        <GraphSettingsPanel
                          computeCalculator={stateManager?.getComputeCalculator() || null}
                          initialSettings={graphSettings}
                          onSave={(settings) => {
                            setGraphSettings(settings);
                            stateManager?.clearCache();
                          }}
                          initialOptions={calculatorOptions}
                          onOptionsSave={(options) => {
                            const optionsWithGraphType = {
                              ...options,
                              graphType: options.graphType || ("2d" as const),
                            };
                            setCalculatorOptions(optionsWithGraphType);
                          }}
                          onGraphTypeChange={handleGraphTypeChange}
                        />
                      </div>
                    )}

                    {activeTab === "formula" && (
                      <div className="h-full">
                        <FormulaEditPanel
                          formulas={formulas}
                          subtitles={subtitles}
                          currentFrame={currentFrame}
                          selectedElementId={selectedFormulaElementId ?? undefined}
                          onElementUpdate={updateElement}
                          onElementDelete={deleteElement}
                          onElementCreate={(element) => {
                            if ("content" in element) {
                              addFormula(element as Omit<FormulaElement, "id">);
                            } else {
                              addSubtitle(element as Omit<SubtitleElement, "id">);
                            }
                          }}
                          onElementSelect={(id) => setSelectedFormulaElementId(id ?? null)}
                        />
                      </div>
                    )}

                    {activeTab === "export" && (
                      <div className="h-full">
                        <VideoExportPanel
                          videoSettings={videoSettings}
                          onVideoSettingsChange={handleVideoSettingsChange}
                          durationFrames={project.durationFrames}
                          fps={fps}
                          onSettingsChange={(settings) => {
                            console.log("Video export settings updated:", settings);
                          }}
                          stateManager={stateManager}
                          calculator={stateManager?.getComputeCalculator() || null}
                          formulas={formulas}
                          subtitles={subtitles}
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
                          {/* project詳細（raw json） */}
                          <div className="p-2 bg-gray-100 rounded">
                            <pre className="text-xs text-gray-600">
                              {JSON.stringify(project, null, 2)}
                            </pre>
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
                onEventSelect={(event) => {
                  if (event && event.id) {
                    setSelectedEventId(event.id);
                    setSelectedStateId(null);
                  }
                  if (!event) {
                    setSelectedEventId(null);
                  }
                }}
                onStateSelect={(state) => {
                  if (state && state.id) setSelectedStateId(state.id);
                  else setSelectedStateId(null);
                }}
                onEventTimeChange={handleEventTimeChange}
                onStateTimeChange={handleStateTimeChange}
                onEventDelete={(eventId) => {
                  if (selectedEventId === eventId) setSelectedEventId(null);
                  removeEvent(eventId);
                }}
                onEventDuplicate={(event) => {
                  // 新しいIDと時刻+1で複製
                  const newEvent = { ...event, id: undefined, frame: event.frame + 1 };
                  insertEvent(newEvent);
                }}
                setActiveTab={setActiveTab}
                selectedEventId={selectedEventId ?? undefined}
                // 数式・字幕関連のprops
                formulas={formulas}
                subtitles={subtitles}
                onFormulaSelect={(formula) => {
                  if (formula) {
                    setSelectedFormulaElementId(formula.id);
                    setActiveTab("formula");
                  } else {
                    setSelectedFormulaElementId(null);
                  }
                }}
                onSubtitleSelect={(subtitle) => {
                  if (subtitle) {
                    setSelectedFormulaElementId(subtitle.id);
                    setActiveTab("formula");
                  } else {
                    setSelectedFormulaElementId(null);
                  }
                }}
                // 数式・字幕のドラッグ・削除機能
                onFormulaTimeChange={(formulaId, newTime) => {
                  updateElementTime(formulaId, newTime);
                }}
                onSubtitleTimeChange={(subtitleId, newTime) => {
                  updateElementTime(subtitleId, newTime);
                }}
                onFormulaDelete={(formulaId) => {
                  if (selectedFormulaElementId === formulaId) {
                    setSelectedFormulaElementId(null);
                  }
                  deleteElement(formulaId);
                }}
                onSubtitleDelete={(subtitleId) => {
                  if (selectedFormulaElementId === subtitleId) {
                    setSelectedFormulaElementId(null);
                  }
                  deleteElement(subtitleId);
                }}
                onFormulaDuplicate={(formula) => {
                  duplicateFormulaElement(formula.id);
                }}
                onSubtitleDuplicate={(subtitle) => {
                  duplicateFormulaElement(subtitle.id);
                }}
              />
            </div>
          </div>
        </ResizablePanel>
      </div>
    </div>
  );
}

export default App;
