import React, { useState, useMemo, useEffect, useRef } from "react";
// 選択矩形の型
type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import type { TimelineEvent, StateEvent, ExpressionEvent } from "../types/timeline";
// TimelineItem型を定義（型エイリアス）
type TimelineItem = TimelineEvent | StateEvent | ExpressionEvent;

interface EventWithTrack extends TimelineEvent {
  track: number;
  width: number;
  left: number;
}

interface TimelineControlsProps {
  onStateSelect?: (state: StateEvent) => void;
  currentFrame: number;
  duration: number;
  fps?: number;
  isPlaying: boolean;
  timeline: TimelineEvent[];
  stateEvents?: StateEvent[];
  calculatedRegions?: Array<{ start: number; end: number }>;
  onSeek: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onInsertEvent?: (time: number, event: Omit<TimelineEvent, "id" | "time" | "frame">) => void;
  onInsertState?: (time: number) => void;
  onEventSelect?: (event: TimelineEvent) => void;
  onEventTimeChange?: (eventId: string, newTime: number) => void; // イベントの時間変更
  onStateTimeChange?: (stateId: string, newTime: number) => void; // Stateの時間変更
  onEventDelete: (eventId: string) => void;
  onEventDuplicate: (event: TimelineEvent) => void;
  selectedEventId?: string;
  setActiveTab: (tab: "state" | "events" | "timeline" | "graph" | "export") => void;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  currentFrame,
  duration,
  isPlaying,
  timeline,
  stateEvents = [],
  calculatedRegions = [],
  onSeek,
  onPlay,
  onPause,
  onInsertEvent,
  onInsertState,
  onEventSelect,
  onEventTimeChange,
  onStateTimeChange,
  onEventDelete,
  fps = 30,
  onEventDuplicate,
  // selectedEventId,
  onStateSelect,
  setActiveTab,
}) => {
  // 複数選択管理
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // ドラッグ選択用
  const [isSelecting, setIsSelecting] = useState(false);
  // frame→秒変換
  const frameToSeconds = (frame: number) => (fps ? frame / fps : frame / 30);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  // ドラッグ選択開始
  const handleSelectMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = timelineContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    selectionStartRef.current = { x, y };
    setIsSelecting(true);
    setSelectionRect({ x, y, width: 0, height: 0 });
  };

  // ドラッグ選択中
  const handleSelectMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const frameToSeconds = (frame: number) => (fps ? frame / fps : frame / 30);
    if (!isSelecting || !selectionStartRef.current) return;
    const rect = timelineContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const start = selectionStartRef.current;
    setSelectionRect({
      x: Math.min(start.x, x),
      y: Math.min(start.y, y),
      width: Math.abs(x - start.x),
      height: Math.abs(y - start.y),
    });
  };

  // ドラッグ選択終了
  const handleSelectMouseUp = (e?: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionRect) return;
    const selected: string[] = [];
    // TimelineItemベースで選択判定
    allMarkers.forEach((item) => {
      const el = document.querySelector(`[data-id='${item.id}']`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const parentRect = timelineContainerRef.current?.getBoundingClientRect();
      if (!parentRect) return;
      const x = rect.left - parentRect.left;
      const y = rect.top - parentRect.top;
      const w = rect.width;
      const h = rect.height;
      if (
        x < selectionRect.x + selectionRect.width &&
        x + w > selectionRect.x &&
        y < selectionRect.y + selectionRect.height &&
        y + h > selectionRect.y
      ) {
        if (item.id) selected.push(item.id);
      }
    });
    // shiftキー押下時は既存選択に追加
    if (e && e.shiftKey) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...selected])));
    } else {
      setSelectedIds(selected);
    }
    setIsSelecting(false);
    setSelectionRect(null);
    selectionStartRef.current = null;
  };

  // <div>現在: {currentFrame}フレーム ({frameToSeconds(currentFrame).toFixed(2)}秒)</div>
  // バックスペースで選択削除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力欄にフォーカスがある場合はショートカットを無効化
      const ae = document.activeElement;
      if (ae && /input|textarea/i.test(ae.tagName)) return;
      if (e.key === "Backspace" && selectedIds.length > 0) {
        selectedIds.forEach((id) => {
          onEventDelete(id);
          if (onStateTimeChange) {
            onStateTimeChange(id, -1); // -1で削除扱い（要onStateTimeChange側でfilter）
          }
        });
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, onEventDelete, onStateTimeChange]);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [insertTime] = useState(0);
  const [dragState, setDragState] = useState<{
    eventId?: string;
    stateId?: string;
    startX: number;
    startTime: number;
    isDragging: boolean;
    type: "event" | "state";
  } | null>(null);
  // 右クリックメニュー
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    event: TimelineEvent | null;
  } | null>(null);
  // ズーム倍率（1=100%、2=200%...）
  const [zoom, setZoom] = useState(1);

  // 複数選択ドラッグ用の初期値保存
  const [multiDragState, setMultiDragState] = useState<{
    startX: number;
    eventStartTimes: { [id: string]: number };
    stateStartTimes: { [id: string]: number };
    isDragging: boolean;
  } | null>(null);

  // ドラッグハンドラー（イベント用）
  const handleItemMouseDown = (item: TimelineItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.id) return;
    if (selectedIds.length > 1) {
      if (!selectedIds.includes(item.id)) return;
      setMultiDragState({
        startX: e.clientX,
        eventStartTimes: Object.fromEntries(
          selectedIds
            .map((id) => {
              // TimelineEvent
              const target = timeline.find((ev) => ev.id === id);
              return [id, target ? target.frame : undefined];
            })
            .filter(([_, t]) => t !== undefined)
        ),
        stateStartTimes: Object.fromEntries(
          selectedIds
            .map((id) => {
              // StateEvent
              const target = stateEvents.find((ev) => ev.id === id);
              return [id, target ? target.frame : undefined];
            })
            .filter(([_, t]) => t !== undefined)
        ),
        isDragging: false,
      });
    } else {
      // 単体ドラッグ開始（型分岐）
      if ("action" in item) {
        setDragState({
          eventId: item.id,
          startX: e.clientX,
          startTime: item.frame,
          isDragging: false,
          type: "event",
        });
      } else if ("state" in item) {
        setDragState({
          stateId: item.id,
          startX: e.clientX,
          startTime: item.frame,
          isDragging: false,
          type: "state",
        });
      } else if ("properties" in item && "type" in item && item.type === "expression") {
        // ExpressionEvent用のドラッグ（仮実装）
        setDragState({
          eventId: item.id,
          startX: e.clientX,
          startTime: item.frame,
          isDragging: false,
          type: "event", // 必要に応じてtype追加
        });
      }
    }
  };

  // スナップ間隔（フレーム）
  const SNAP_FRAME = 1;

  // スナップON/OFF状態
  const [snapEnabled, setSnapEnabled] = useState(true);

  // キー押下でスナップON/OFF切り替え
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 例: AltキーでスナップOFF
      if (e.altKey) setSnapEnabled(false);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setSnapEnabled(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // frame単位でスナップする関数
  const snapFrame = React.useCallback(
    (frame: number) => {
      if (!snapEnabled) return frame;
      return Math.round(frame / SNAP_FRAME) * SNAP_FRAME;
    },
    [snapEnabled]
  );

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;
      const deltaX = e.clientX - dragState.startX;
      const timelineElement = document.querySelector(".timeline-container");
      if (!timelineElement) return;
      const timelineWidth = timelineElement.getBoundingClientRect().width;
      const deltaFrame = ((deltaX / timelineWidth) * duration) / zoom;
      // frame単位でスナップ
      const newFrame = snapFrame(Math.max(0, Math.min(duration, dragState.startTime + deltaFrame)));
      if (!dragState.isDragging && Math.abs(deltaX) > 5) {
        setDragState((prev) => (prev ? { ...prev, isDragging: true } : null));
      }
      if (dragState.isDragging) {
        if (dragState.type === "event" && dragState.eventId && onEventTimeChange) {
          onEventTimeChange(dragState.eventId, newFrame);
        }
        if (dragState.type === "state" && dragState.stateId && onStateTimeChange) {
          onStateTimeChange(dragState.stateId, newFrame);
        }
      }
    },
    [dragState, duration, onEventTimeChange, onStateTimeChange, zoom, snapFrame]
  );

  const handleMouseUp = React.useCallback(() => {
    setDragState(null);
  }, []);

  // マウスイベントリスナーの追加/削除
  React.useEffect(() => {
    if (dragState) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);
  useEffect(() => {
    if (!multiDragState) return;
    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - multiDragState.startX;
      const timelineElement = document.querySelector(".timeline-container");
      if (!timelineElement) return;
      const timelineWidth = timelineElement.getBoundingClientRect().width;
      const deltaFrame = ((deltaX / timelineWidth) * duration) / zoom;
      if (!multiDragState.isDragging && Math.abs(deltaX) > 5) {
        setMultiDragState((prev) => (prev ? { ...prev, isDragging: true } : null));
      }
      if (multiDragState.isDragging) {
        // イベント
        Object.entries(multiDragState.eventStartTimes).forEach(([id, startTime]) => {
          const newFrame = snapFrame(Math.max(0, Math.min(duration, startTime + deltaFrame)));
          if (onEventTimeChange) onEventTimeChange(id, newFrame);
        });
        // StateEvent
        Object.entries(multiDragState.stateStartTimes).forEach(([id, startTime]) => {
          const newFrame = snapFrame(Math.max(0, Math.min(duration, startTime + deltaFrame)));
          if (onStateTimeChange) onStateTimeChange(id, newFrame);
        });
      }
    };
    const handleUp = () => {
      setMultiDragState(null);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [multiDragState, duration, zoom, onEventTimeChange, onStateTimeChange, snapFrame]);
  const getEventDuration = (event: TimelineEvent): number => {
    if (event.action === "startAnimation") {
      // animation eventはdurationFramesで管理
      return (event.args.durationFrames as number) || 1;
    }
    return 0.1; // デフォルトの表示幅
  };

  // イベントをトラック（レーン）に配置
  const eventsWithTracks = useMemo(() => {
    const sortedEvents = [...timeline].sort((a, b) => a.frame - b.frame);
    const tracks: EventWithTrack[][] = [];

    const result: EventWithTrack[] = sortedEvents.map((event) => {
      const eventDuration = getEventDuration(event);
      const eventEnd = event.frame + eventDuration;

      // 空いているトラックを探す
      let trackIndex = 0;
      while (trackIndex < tracks.length) {
        const track = tracks[trackIndex];
        const canFit = track.every((existingEvent) => {
          const existingEnd = existingEvent.frame + getEventDuration(existingEvent);
          return event.frame >= existingEnd || eventEnd <= existingEvent.frame;
        });

        if (canFit) break;
        trackIndex++;
      }

      // 新しいトラックが必要な場合
      if (trackIndex >= tracks.length) {
        tracks.push([]);
      }

      // left/widthをズーム倍率で補正
      const eventWithTrack: EventWithTrack = {
        ...event,
        track: trackIndex,
        width: (eventDuration / duration) * 100 * zoom,
        left: (event.frame / duration) * 100,
      };

      tracks[trackIndex].push(eventWithTrack);
      return eventWithTrack;
    });

    return { events: result, trackCount: tracks.length };
  }, [timeline, duration, zoom]);

  // イベントタイプに応じた色を取得
  const getEventColor = (action: string): string => {
    switch (action) {
      case "setExpression":
        return "#f59e0b"; // orange
      case "setMathBounds":
        return "#84cc16"; // lime
      case "startAnimation":
        return "#8b5cf6"; // purple
      case "endAnimation":
        return "#6366f1"; // indigo
      default:
        return "#6b7280"; // gray
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrame = snapFrame(parseFloat(e.target.value));
    onSeek(newFrame);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    // ドラッグと同じ計算式: (clickX / timelineWidth) * duration / zoom
    const timelineWidth = rect.width;
    const clickFrame = snapFrame((clickX / timelineWidth) * duration);
    onSeek(Math.max(0, Math.min(duration, clickFrame)));
  };

  const handleTimelineDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    // ドラッグと同じ計算式: (clickX / timelineWidth) * duration / zoom
    const timelineWidth = rect.width;
    const clickFrame = snapFrame((clickX / timelineWidth) * duration);
    if (onInsertEvent) {
      onInsertEvent(Math.max(0, Math.min(duration, clickFrame)), {
        action: "setExpression",
        args: {
          id: "",
        },
      });
      console.log(`Created expression event at frame ${clickFrame}`);
    }
  };

  const insertEventAtTime = (
    action: "setExpression" | "setMathBounds" | "startAnimation" | "endAnimation",
    args: Record<string, unknown>
  ) => {
    if (onInsertEvent) {
      onInsertEvent(insertTime, { action, args });
    }
    setShowInsertMenu(false);
  };

  const insertStateAtTime = () => {
    if (onInsertState) {
      onInsertState(insertTime);
    }
    setShowInsertMenu(false);
  };

  // frame→秒表示（mm:ss）
  const formatTime = (frame: number) => {
    const seconds = frameToSeconds(frame);
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // 秒単位の目盛り生成（fpsでframe→秒変換）
  const generateTimeMarks = () => {
    const marks = [];
    // 目盛り間隔（秒）
    const totalSeconds = frameToSeconds(duration);
    const interval = totalSeconds <= 10 ? 1 : totalSeconds <= 30 ? 5 : 10;
    for (let sec = 0; sec <= totalSeconds; sec += interval) {
      const frame = Math.round(sec * fps);
      const position = (frame / duration) * 100;
      marks.push({ sec, frame, position });
    }
    // 最後の目盛り
    if (marks[marks.length - 1]?.frame !== duration) {
      marks.push({ sec: totalSeconds, frame: duration, position: 100 });
    }
    return marks;
  };
  const timeMarks = generateTimeMarks();

  // ツールチップの位置を動的に調整する関数
  const getTooltipPosition = (eventPosition: number) => {
    // 画面幅の20%と80%の間にある場合は中央配置
    if (eventPosition >= 20 && eventPosition <= 80) {
      return "left-1/2 transform -translate-x-1/2";
    }
    // 左端近くの場合は左寄せ
    if (eventPosition < 20) {
      return "left-0";
    }
    // 右端近くの場合は右寄せ
    return "right-0";
  };

  // TimelineItem型で全マーカーを一元管理
  const allMarkers: TimelineItem[] = useMemo(() => {
    // ExpressionEventなど今後追加時はここで拡張
    return [...timeline, ...stateEvents];
  }, [timeline, stateEvents]);

  return (
    <div className="h-full flex flex-col bg-gray-800 text-white border-t border-gray-700">
      {/* コンパクトな再生コントロール */}
      <div className="flex items-center justify-between px-6 py-1 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onSeek(0)}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
            title="最初に戻る"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
            title={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={() => onSeek(duration)}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
            title="最後に移動"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* 現在時刻表示 */}
        <div className="flex items-center space-x-4 text-sm">
          <span className="font-mono text-blue-400">{formatTime(currentFrame)}</span>
          <span className="text-gray-500">/</span>
          <span className="font-mono text-gray-400">{formatTime(duration)}</span>
        </div>
      </div>

      {/* メインタイムライン */}
      <div className="flex flex-col flex-1 min-h-0 px-4 py-2">
        {/* ズームコントロール（背景のみ強化） */}
        <div className="relative flex items-center mb-2" style={{ height: 32 }}>
          <span className="text-xs text-gray-400 relative z-10 ml-2">ズーム</span>
          <div className="relative mx-2" style={{ width: 128 }}>
            {/* 背景軸と両端ラベル（スライダー幅に合わせる） */}
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 pointer-events-none"
              style={{ width: "100%" }}
            >
              <div className="w-full h-1 bg-gray-700 rounded-full" />
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full bg-transparent appearance-none cursor-pointer relative z-10"
              style={{ accentColor: "#6366f1" }}
            />
          </div>
          <span className="text-xs text-gray-300 relative z-10">{(zoom * 100).toFixed(0)}%</span>
        </div>
        {/* タイムラインと時間軸を一体化したスクロールコンテナ */}
        <div className="flex-1 relative bg-gray-900 rounded-lg px-4 py-2 flex flex-col">
          <div
            className="timeline-container relative overflow-x-auto flex-1 min-h-0 custom-scrollbar px-4"
            style={{ width: "100%", minWidth: 0 }}
            ref={timelineContainerRef}
            onMouseDown={handleSelectMouseDown}
            onMouseMove={handleSelectMouseMove}
            onMouseUp={handleSelectMouseUp}
          >
            {/* ドラッグ選択矩形 */}
            {isSelecting && selectionRect && (
              <div
                style={{
                  position: "absolute",
                  left: selectionRect.x + (timelineContainerRef.current?.scrollLeft ?? 0),
                  top: selectionRect.y,
                  width: selectionRect.width,
                  height: selectionRect.height,
                  background: "rgba(0, 120, 255, 0.2)",
                  border: "1px solid #0078ff",
                  pointerEvents: "none",
                  zIndex: 1000,
                }}
              />
            )}
            {/* 時間軸の目盛り（ズームに合わせて拡大） */}
            <div
              className="relative mb-4 flex-shrink-0"
              style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
            >
              <div className="relative h-3">
                {timeMarks.map((mark, index) => (
                  <div
                    key={index}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${mark.position}%`, transform: "translateX(-50%)" }}
                  >
                    {/* 目盛り線 */}
                    <div className="w-px h-2 bg-gray-500"></div>
                    {/* 秒ラベル */}
                    <span className="text-xs text-gray-400 mt-1 select-none">
                      {mark.sec === Math.floor(mark.sec)
                        ? `${mark.sec}s`
                        : `${mark.sec.toFixed(1)}s`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* 多層イベントトラック */}
            <div className="relative h-full" style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
              {/* メインのタイムライン軸（背景） */}
              <div
                className="absolute top-0 left-0 h-8 bg-gray-700 rounded cursor-pointer z-10"
                style={{ width: "100%" }}
                onClick={handleTimelineClick}
                onDoubleClick={handleTimelineDoubleClick}
                title="クリックでシーク、ダブルクリックでイベント挿入"
              >
                {/* 現在時刻のインジケーター */}
                <div
                  className="absolute top-0 w-1 h-full bg-white rounded shadow-lg z-50"
                  style={{
                    left: `${(currentFrame / duration) * 100}%`,
                    transform: "translateX(-50%)",
                  }}
                ></div>

                {/* 再生済み部分 */}
                <div
                  className="absolute top-0 left-0 h-full bg-blue-500 rounded opacity-30"
                  style={{ width: `${(currentFrame / duration) * 100}%` }}
                ></div>
              </div>
              {/* 計算済み領域の表示（背景バー） */}
              {calculatedRegions.map((region, index) => {
                const startPos = (region.start / duration) * 100 * zoom;
                const endPos =
                  region.end === Infinity ? 100 * zoom : (region.end / duration) * 100 * zoom;
                const width = endPos - startPos;
                return (
                  <div
                    key={`region-${index}`}
                    className="absolute bg-green-200 opacity-20 rounded z-5"
                    style={{
                      left: `${startPos}%`,
                      width: `${width}%`,
                      height: "100%",
                      top: 0,
                    }}
                    title={`Calculated region: ${region.start.toFixed(1)}s - ${
                      region.end === Infinity ? "∞" : region.end.toFixed(1)
                    }s`}
                  ></div>
                );
              })}
              {/* マーカー描画（イベント・StateEvent・今後の新種も対応） */}
              {allMarkers.map((item, index) => {
                // type判定で描画分岐（今後新種追加時もここで分岐）
                if ("action" in item) {
                  // TimelineEvent（イベントマーカー）
                  const event = item as TimelineEvent;
                  const isSelected = event.id ? selectedIds.includes(event.id) : false;
                  const dragEvent =
                    dragState && dragState.eventId === event.id && dragState.isDragging;
                  // left/width/track計算はeventsWithTracks.eventsから取得
                  const eventWithTrack = eventsWithTracks.events.find((ev) => ev.id === event.id);
                  if (!eventWithTrack) return null;
                  return (
                    <div
                      key={event.id || index}
                      data-id={event.id || index}
                      className={`absolute rounded-md cursor-pointer hover:scale-105 transition-transform z-20 group select-none ${
                        isSelected ? "ring-2 ring-blue-400 ring-opacity-80" : ""
                      } ${dragEvent ? "cursor-move opacity-80" : ""}`}
                      style={{
                        left: `${eventWithTrack.left}%`,
                        width: `${Math.max(eventWithTrack.width, 1)}%`,
                        top: `${eventWithTrack.track * 35 + 10}px`,
                        height: "30px",
                        backgroundColor: getEventColor(event.action),
                        border: isSelected
                          ? "2px solid #3b82f6"
                          : "2px solid rgba(255,255,255,0.3)",
                      }}
                      onMouseDown={(e) => handleItemMouseDown(item, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (dragState && dragState.isDragging) return;
                        if (e.shiftKey && event.id) {
                          setSelectedIds((prev) => {
                            if (!event.id || prev.includes(event.id)) return prev;
                            return [...prev, event.id].filter((id): id is string => !!id);
                          });
                        } else if (event.id) {
                          setSelectedIds([event.id]);
                        }
                        if (onEventSelect) {
                          onEventSelect(event);
                        } else {
                          onSeek(event.frame);
                        }
                        // イベントマーカー選択時は必ずEventタブに切り替え
                        setActiveTab("events");
                      }}
                      onDoubleClick={() => event.id && setSelectedIds([event.id])}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          event,
                        });
                      }}
                      title={`${event.action} at frame ${event.frame} (ドラッグで移動可能)`}
                    >
                      {/* イベント内容 */}
                      <div className="px-2 py-1 text-xs text-white font-medium truncate select-none">
                        {event.action}
                      </div>
                      {/* ホバー時の詳細情報 */}
                      <div
                        className={`absolute bottom-full mb-2 ${getTooltipPosition(
                          eventWithTrack.left
                        )} bg-gray-900 text-white text-xs rounded-md py-2 px-3 whitespace-nowrap shadow-lg border border-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none max-w-xs`}
                        style={{ zIndex: 10000 }}
                      >
                        <div className="font-medium">{event.action}</div>
                        <div className="text-gray-300">フレーム: {event.frame}</div>
                        <div className="text-gray-400 break-words">
                          {JSON.stringify(event.args, null, 1)}
                        </div>
                        {/* ツールチップの矢印 */}
                        <div
                          className={`absolute top-full ${
                            eventWithTrack.left >= 20 && eventWithTrack.left <= 80
                              ? "left-1/2 transform -translate-x-1/2"
                              : eventWithTrack.left < 20
                              ? "left-4"
                              : "right-4"
                          }`}
                        >
                          <div className="border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  );
                } else if ("state" in item) {
                  // StateEvent（状態マーカー）
                  const stateEvent = item as StateEvent;
                  const position = (stateEvent.frame / duration) * 100;
                  const isDragging =
                    dragState &&
                    dragState.type === "state" &&
                    dragState.stateId === stateEvent.id &&
                    dragState.isDragging;
                  const isSelected = stateEvent.id ? selectedIds.includes(stateEvent.id) : false;
                  return (
                    <div
                      key={stateEvent.id || `state-${index}`}
                      data-id={stateEvent.id || `state-${index}`}
                      className="absolute z-30"
                      style={{ left: `${position}%`, top: "0px" }}
                    >
                      <div
                        className={`w-4 h-8 bg-green-500 rounded-sm transform -translate-x-1/2 relative border border-green-400 shadow-sm cursor-pointer hover:bg-green-400 transition-colors group ${
                          isDragging ? "cursor-move opacity-80" : ""
                        } ${isSelected ? "ring-4 ring-blue-400 border-2 border-blue-500" : ""}`}
                        onMouseDown={(e) => {
                          if (e.button === 0) {
                            handleItemMouseDown(item, e);
                          }
                        }}
                        onClick={(e) => {
                          // ドラッグ中は選択処理をスキップ
                          if (dragState && dragState.type === "state" && dragState.isDragging)
                            return;
                          e.stopPropagation();
                          if (e.shiftKey && item.id) {
                            setSelectedIds((prev) => {
                              if (!item.id || prev.includes(item.id)) return prev;
                              return [...prev, item.id].filter((id): id is string => !!id);
                            });
                          } else if (item.id) {
                            setSelectedIds([item.id]);
                          }
                          onSeek(item.frame);
                          if (onStateSelect && "state" in item) onStateSelect(item);
                          // 種類に応じてタブ切り替え
                          if ("state" in item) {
                            setActiveTab("state");
                          } else {
                            setActiveTab("events");
                          }
                        }}
                        title={`State Event at frame ${stateEvent.frame}`}
                      >
                        {/* StateEventのツールチップ */}
                        <div
                          className={`absolute bottom-full mb-2 ${getTooltipPosition(
                            position
                          )} bg-gray-900 text-white text-xs rounded-md py-2 px-3 whitespace-nowrap shadow-lg border border-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none max-w-xs`}
                          style={{ zIndex: 10000 }}
                        >
                          <div className="font-medium text-green-300">State Event</div>
                          <div className="text-gray-300">フレーム: {stateEvent.frame}</div>
                          <div className="text-gray-400 break-words">
                            {stateEvent.description || "Captured state"}
                          </div>
                          <div className="text-xs text-blue-300 mt-1 font-medium">
                            クリックでシーク
                          </div>
                          {/* ツールチップの矢印 */}
                          <div
                            className={`absolute top-full ${
                              position >= 20 && position <= 80
                                ? "left-1/2 transform -translate-x-1/2"
                                : position < 20
                                ? "left-4"
                                : "right-4"
                            }`}
                          >
                            <div className="border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else if ("properties" in item && "type" in item && item.type === "expression") {
                  // ExpressionEvent（仮実装例）
                  const exprEvent = item as ExpressionEvent;
                  const position = (exprEvent.frame / duration) * 100;
                  const isSelected = exprEvent.id ? selectedIds.includes(exprEvent.id) : false;
                  return (
                    <div
                      key={exprEvent.id || `expr-${index}`}
                      data-id={exprEvent.id || `expr-${index}`}
                      className="absolute z-40"
                      style={{ left: `${position}%`, top: "40px" }}
                    >
                      <div
                        className={`w-4 h-8 bg-yellow-400 rounded-sm transform -translate-x-1/2 relative border border-yellow-300 shadow-sm cursor-pointer hover:bg-yellow-300 transition-colors group ${
                          isSelected ? "ring-4 ring-blue-400 border-2 border-blue-500" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey && exprEvent.id) {
                            setSelectedIds((prev) => {
                              if (!exprEvent.id || prev.includes(exprEvent.id)) return prev;
                              return [...prev, exprEvent.id].filter((id): id is string => !!id);
                            });
                          } else if (exprEvent.id) {
                            setSelectedIds([exprEvent.id]);
                          }
                          onSeek(exprEvent.frame);
                          setActiveTab("events");
                        }}
                        title={`Expression Event at frame ${exprEvent.frame}`}
                      >
                        {/* ...ツールチップ等は既存流用... */}
                      </div>
                    </div>
                  );
                }
                // 今後ExpressionEvent等追加時はここで分岐
                return null;
              })}
              {/* 右クリックメニュー: オーバーレイでラップし、メニュー以外クリックで閉じる */}
              {contextMenu && contextMenu.event && (
                <>
                  <div
                    className="fixed inset-0 z-[99998]"
                    style={{ background: "transparent" }}
                    onClick={() => setContextMenu(null)}
                  />
                  <div
                    className="fixed bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700"
                    style={{
                      left: (() => {
                        const menuWidth = 180;
                        const winWidth = window.innerWidth;
                        return Math.min(contextMenu.x, winWidth - menuWidth - 8);
                      })(),
                      top: (() => {
                        const menuHeight = 140;
                        // 必ず上方向に表示（下にinput rangeがあるため）
                        return Math.max(contextMenu.y - menuHeight - 8, 8);
                      })(),
                      minWidth: 180,
                      zIndex: 99999,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                    }}
                  >
                    <div className="py-2">
                      <button
                        className="block w-full text-left px-5 py-3 text-sm font-medium rounded-lg hover:bg-gray-700 hover:text-blue-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu(null);
                          if (onEventSelect && contextMenu.event) onEventSelect(contextMenu.event);
                        }}
                      >
                        編集
                      </button>
                      <button
                        className="block w-full text-left px-5 py-3 text-sm font-medium rounded-lg hover:bg-gray-700 hover:text-green-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu(null);
                          if (onEventDuplicate && contextMenu.event)
                            onEventDuplicate(contextMenu.event);
                        }}
                      >
                        複製
                      </button>
                      <button
                        className="block w-full text-left px-5 py-3 text-sm font-medium rounded-lg hover:bg-gray-700 hover:text-red-300 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu(null);
                          if (onEventDelete && contextMenu.event?.id)
                            onEventDelete(contextMenu.event.id);
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* インタラクティブスライダー（UI改善） */}
          <div className="relative flex-shrink-0 mt-4 mb-2">
            {/* 軸と目盛り */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 pointer-events-none">
              <div className="w-full h-1 bg-gray-700 rounded-full" />
              {/* 目盛りラベル */}
              <div
                className="absolute w-full flex justify-between text-xs text-gray-400 font-mono px-1"
                style={{ top: 12 }}
              >
                <span>0:00</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            {/* スライダー本体 */}
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentFrame}
              onChange={handleSliderChange}
              className="w-full h-6 bg-transparent appearance-none cursor-pointer relative z-10"
              style={{
                WebkitAppearance: "none",
                background: "transparent",
              }}
            />
          </div>
        </div>

        {/* 詳細な時間情報と凡例 */}
        <div className="flex justify-between items-center text-xs text-gray-500 mt-3">
          <div className="flex space-x-4">
            <span>進行率: {((currentFrame / duration) * 100).toFixed(1)}%</span>
            <span>残り時間: {formatTime(duration - currentFrame)}</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* 凡例 */}
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-emerald-500 rounded-sm border border-emerald-400"></div>
              <span>State</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-400 rounded-sm border border-yellow-300"></div>
              <span>Event</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-200 opacity-60"></div>
              <span>Calculated</span>
            </div>
          </div>
        </div>
      </div>

      {/* イベント/State挿入メニュー */}
      {showInsertMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 text-black">
            <h3 className="text-lg font-semibold mb-4">
              時刻 {insertTime.toFixed(2)}s にアイテムを挿入
            </h3>

            <div className="space-y-3">
              <button
                onClick={insertStateAtTime}
                className="w-full p-3 text-left bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg"
              >
                <div className="font-medium text-green-800">Stateイベント</div>
                <div className="text-sm text-green-600">現在のDesmos状態をキャプチャ</div>
              </button>

              <button
                onClick={() => {
                  insertEventAtTime("setExpression", {
                    id: "",
                  });
                }}
                className="w-full p-3 text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
              >
                <div className="font-medium text-blue-800">式イベント</div>
                <div className="text-sm text-blue-600">新しい数式を追加</div>
              </button>

              <button
                onClick={() =>
                  insertEventAtTime("setMathBounds", { left: -5, right: 5, top: 5, bottom: -5 })
                }
                className="w-full p-3 text-left bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg"
              >
                <div className="font-medium text-purple-800">ズーム</div>
                <div className="text-sm text-purple-600">グラフの表示範囲を変更</div>
              </button>

              <button
                onClick={() =>
                  insertEventAtTime("startAnimation", {
                    variableName: "a",
                    fromValue: 0,
                    toValue: 1,
                    duration: 2,
                  })
                }
                className="w-full p-3 text-left bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg"
              >
                <div className="font-medium text-indigo-800">変数アニメーション</div>
                <div className="text-sm text-indigo-600">変数を時間をかけて変化させる</div>
              </button>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowInsertMenu(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      {/* スクロールバーのカスタムスタイル */}
      <style>{`
      .custom-scrollbar::-webkit-scrollbar {
        height: 8px;
        background: #222;
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #6366f1;
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #4f46e5;
      }
      .custom-scrollbar {
        scrollbar-color: #6366f1 #222;
        scrollbar-width: thin;
      }
    `}</style>
    </div>
  );
};
