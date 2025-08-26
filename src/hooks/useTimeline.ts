import { useState, useCallback, useRef, useMemo } from "react";
import type { Calculator } from "../types/desmos";
import type {
  TimelineEvent,
  ContinuousEvent,
  AnimationProject,
  UnifiedEvent,
} from "../types/timeline";
import { useStateManager } from "./useStateManager";

// UnifiedEventをTimelineEventに変換する関数
const convertUnifiedEventToTimelineEvent = (unifiedEvent: UnifiedEvent): TimelineEvent => {
  switch (unifiedEvent.type) {
    case "expression": {
      const args = { ...(unifiedEvent.properties || {}) };
      return {
        id: unifiedEvent.id,
        frame: unifiedEvent.frame,
        action: "setExpression",
        args,
      };
    }
    case "bounds":
      return {
        id: unifiedEvent.id,
        frame: unifiedEvent.frame,
        action: "setMathBounds",
        args: unifiedEvent.bounds || { left: -10, right: 10, top: 10, bottom: -10 },
      };
    case "animation":
      return {
        id: unifiedEvent.id,
        frame: unifiedEvent.frame,
        action: "startAnimation",
        args: unifiedEvent.animation || {
          type: "variable",
          targetId: "",
          durationFrames: 1,
          variable: { name: "", startValue: 0, endValue: 1, autoDetect: false },
          easing: "linear",
        },
      };
    default:
      throw new Error(`Unknown unified event type: ${unifiedEvent.type}`);
  }
};

// TimelineEventをUnifiedEventに変換する関数
const convertTimelineEventToUnifiedEvent = (timelineEvent: TimelineEvent): UnifiedEvent => {
  switch (timelineEvent.action) {
    case "setExpression": {
      const properties: Record<string, unknown> = {};
      Object.entries(timelineEvent.args).forEach(([key, value]) => {
        if (value !== undefined) {
          properties[key] = value;
        }
      });
      return {
        id: timelineEvent.id || `event-${Date.now()}`,
        frame: timelineEvent.frame,
        type: "expression",
        properties,
      };
    }
    case "setMathBounds":
      return {
        id: timelineEvent.id || `event-${Date.now()}`,
        frame: timelineEvent.frame,
        type: "bounds",
        bounds: timelineEvent.args as { left: number; right: number; top: number; bottom: number },
      };
    case "startAnimation":
      return {
        id: timelineEvent.id || `event-${Date.now()}`,
        frame: timelineEvent.frame,
        type: "animation",
        animation: timelineEvent.args as {
          type: "variable" | "property" | "action";
          targetId: string;
          durationFrames: number;
          variable?: { name: string; startValue: number; endValue: number; autoDetect?: boolean };
          property?: { name: string; startValue: number; endValue: number };
          action?: { steps: number; frameInterval: number };
          easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
        },
      };
    default:
      return {
        id: timelineEvent.id || `event-${Date.now()}`,
        frame: timelineEvent.frame,
        type: "expression",
        properties: {},
      };
  }
};

export const useTimeline = (calculator: Calculator | null) => {
  const [project, setProject] = useState<AnimationProject>({
    initialState: {
      version: 11,
      randomSeed: "8eb0419a89e6a0b88664723b3d44dca7",
      graph: {
        viewport: {
          xmin: -10,
          ymin: -11.303462321792262,
          xmax: 10,
          ymax: 11.303462321792262,
        },
        __v12ViewportLatexStash: {
          xmin: "-10",
          xmax: "10",
          ymin: "-11.303462321792262",
          ymax: "11.303462321792262",
        },
      },
      expressions: {
        list: [
          {
            type: "expression",
            id: "1",
            color: "#c74440",
            latex: "x^{2}",
            frame: 0,
          },
          {
            type: "expression",
            id: "36",
            color: "#2d70b3",
            latex: "y=x+1",
            frame: 0,
          },
        ],
      },
      includeFunctionParametersInRandomSeed: true,
      doNotMigrateMovablePointStyle: true,
    },
    timeline: [
      {
        id: "3",
        frame: 150,
        action: "setMathBounds",
        args: { left: -5, right: 5, top: 5, bottom: -5 },
      },
    ],
    stateEvents: [],
    continuousEvents: [],
    durationFrames: 300,
    fps: 30,
  });

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);

  // StateManagerのフックを使用
  const {
    stateManager,
    addEvent: addEventToStateManager,
    removeEvent: removeEventFromStateManager,
    addStateEvent: addStateEventToStateManager,
    createStateEventFromCurrentCalculator,
    clearCache,
    debugStateCalculation,
    getDebugInfo: getStateManagerDebugInfo,
  } = useStateManager({
    displayCalculator: calculator,
    autoCreateComputeCalculator: true,
  });

  // プロジェクトの変更時にStateManagerのイベントを同期
  const projectStringRef = useRef<string>("");

  useMemo(() => {
    if (!stateManager) return;

    // プロジェクトの内容をシリアライズして変更を検出
    const currentProjectString = JSON.stringify({
      timeline: project.timeline,
      stateEvents: project.stateEvents,
    });

    // 内容が変更された場合のみ同期
    if (projectStringRef.current !== currentProjectString) {
      console.log("[useTimeline] Project changed, synchronizing with StateManager");

      // StateManagerのタイムラインをクリアしてから再構築
      stateManager.clearTimeline();

      // TimelineEventをUnifiedEventに変換してStateManagerに登録
      const unifiedEvents = project.timeline.map(convertTimelineEventToUnifiedEvent);
      unifiedEvents.forEach((event) => addEventToStateManager(event));

      // StateManagerのstateEventsをクリアしてから再構築
      stateManager.clearStateEvents();

      // StateEventをStateManagerに登録
      project.stateEvents.forEach((stateEvent) => addStateEventToStateManager(stateEvent));

      projectStringRef.current = currentProjectString;

      console.log("[useTimeline] Synchronized events with StateManager:", {
        timelineEvents: unifiedEvents.length,
        stateEvents: project.stateEvents.length,
      });
    }
  }, [
    project.timeline,
    project.stateEvents,
    stateManager,
    addEventToStateManager,
    addStateEventToStateManager,
  ]);

  // プロジェクトの参照を安定化
  const projectRef = useRef(project);
  projectRef.current = project;

  // 最後に適用されたstateの時刻を追跡
  const lastAppliedFrameRef = useRef<number>(-1);

  // 特定の時刻に移動（新しいStateManager使用）
  const seekTo = useCallback(
    async (frame: number) => {
      if (!calculator || !stateManager) return;

      setCurrentFrame(frame);

      try {
        // StateManagerを使用して状態を適用
        await stateManager.getStateAtFrame(frame);
        lastAppliedFrameRef.current = frame;

        console.log(`[useTimeline] Seeked to frame ${frame}`);
      } catch (error) {
        console.error(`[useTimeline] Failed to seek to frame ${frame}:`, error);
      }
    },
    [calculator, stateManager]
  );

  // アニメーション再生（StateManager使用）
  const play = useCallback(() => {
    if (!calculator || isPlaying || !stateManager) return;

    setIsPlaying(true);
    const startFrame = currentFrame;
    const fps = project.fps || 30;
    const startTime = Date.now();

    const animate = async () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const newFrame = startFrame + Math.round(elapsed * fps);
      const currentProject = projectRef.current;

      if (newFrame >= currentProject.durationFrames) {
        setCurrentFrame(currentProject.durationFrames);
        setIsPlaying(false);

        // 最終フレームの状態を適用
        try {
          await stateManager.getStateAtFrame(currentProject.durationFrames);
          lastAppliedFrameRef.current = currentProject.durationFrames;
        } catch (error) {
          console.error("[useTimeline] Failed to apply final state:", error);
        }
        return;
      }

      setCurrentFrame(newFrame);

      // 状態適用の頻度制御
      const updateThreshold = 1; // 1フレーム
      const frameDiff = Math.abs(newFrame - lastAppliedFrameRef.current);

      if (frameDiff >= updateThreshold) {
        try {
          await stateManager.getStateAtFrame(newFrame);
          lastAppliedFrameRef.current = newFrame;
        } catch (error) {
          console.warn("[useTimeline] Failed to apply state during playback:", error);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [calculator, isPlaying, currentFrame, stateManager, project.fps]);

  // アニメーションを停止
  const pause = useCallback(() => {
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  // StateEventを追加
  const addStateEvent = useCallback(
    (frame: number, description?: string) => {
      if (!calculator || !stateManager) return null;

      const stateEvent = createStateEventFromCurrentCalculator(frame, description);
      if (!stateEvent) return null;

      setProject((prev) => ({
        ...prev,
        stateEvents: [...prev.stateEvents, stateEvent].sort((a, b) => a.frame - b.frame),
      }));

      console.log(`[useTimeline] State event added at frame ${frame}:`, stateEvent);
      return stateEvent;
    },
    [calculator, stateManager, createStateEventFromCurrentCalculator]
  );

  // StateEventを削除
  const removeStateEvent = useCallback(
    (eventId: string) => {
      if (!stateManager) return;

      removeEventFromStateManager(eventId);

      setProject((prev) => ({
        ...prev,
        stateEvents: prev.stateEvents.filter((event) => event.id !== eventId),
      }));

      console.log(`[useTimeline] State event removed: ${eventId}`);
    },
    [stateManager, removeEventFromStateManager]
  );

  // 現在時刻でStateEventを作成
  const captureCurrentState = useCallback(
    (description?: string) => {
      return addStateEvent(currentFrame, description || `Captured state at frame ${currentFrame}`);
    },
    [addStateEvent, currentFrame]
  );

  // イベントを追加
  const addEvent = useCallback(
    (event: Omit<TimelineEvent, "id">) => {
      const newEvent: TimelineEvent = {
        ...event,
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      setProject((prev) => ({
        ...prev,
        timeline: [...prev.timeline, newEvent].sort((a, b) => a.frame - b.frame),
      }));

      // StateManagerに追加
      const unifiedEvent = convertTimelineEventToUnifiedEvent(newEvent);
      addEventToStateManager(unifiedEvent);

      console.log(`[useTimeline] Event added:`, newEvent);
    },
    [addEventToStateManager]
  );

  // 連続イベントを追加
  const addContinuousEvent = useCallback((event: ContinuousEvent) => {
    setProject((prev) => ({
      ...prev,
      continuousEvents: [...prev.continuousEvents, event],
    }));

    console.log(`[useTimeline] Continuous event added:`, event);
  }, []);

  // イベントを削除
  const removeEvent = useCallback(
    (eventId: string) => {
      setProject((prev) => ({
        ...prev,
        timeline: prev.timeline.filter((event) => event.id !== eventId),
      }));

      // StateManagerからも削除
      removeEventFromStateManager(eventId);

      console.log(`[useTimeline] Event removed: ${eventId}`);
    },
    [removeEventFromStateManager]
  );

  // TimelineEventを更新
  const updateEvent = useCallback(
    (eventId: string, updates: Partial<Omit<TimelineEvent, "id">>) => {
      let updated = false;

      console.log(`[useTimeline] Updating event ${eventId}:`, updates);

      setProject((prev) => {
        const newTimeline = prev.timeline.map((event) => {
          if (event.id === eventId) {
            updated = true;
            return { ...event, ...updates };
          }
          return event;
        });

        if (updated) {
          console.log(`[useTimeline] Event ${eventId} updated, timeline will be re-synced`);
          return { ...prev, timeline: newTimeline };
        }

        return prev;
      });

      return updated;
    },
    []
  );

  // TimelineEventを挿入
  const insertEvent = useCallback(
    (event: Omit<TimelineEvent, "id">) => {
      const newEvent: TimelineEvent = {
        ...event,
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      setProject((prev) => ({
        ...prev,
        timeline: [...prev.timeline, newEvent].sort((a, b) => a.frame - b.frame),
      }));

      // StateManagerに追加
      const unifiedEvent = convertTimelineEventToUnifiedEvent(newEvent);
      addEventToStateManager(unifiedEvent);

      console.log(`[useTimeline] Event inserted:`, newEvent);
      return newEvent;
    },
    [addEventToStateManager]
  );

  // UnifiedEventを更新する機能
  const updateUnifiedEvent = useCallback((unifiedEvent: UnifiedEvent) => {
    console.log("[useTimeline] Updating UnifiedEvent:", unifiedEvent);

    setProject((prev) => {
      const newTimeline = prev.timeline.map((event) =>
        event.id === unifiedEvent.id ? convertUnifiedEventToTimelineEvent(unifiedEvent) : event
      );

      const hasChanged = JSON.stringify(prev.timeline) !== JSON.stringify(newTimeline);

      if (hasChanged) {
        console.log("[useTimeline] Timeline updated, triggering re-sync");
        return {
          ...prev,
          timeline: newTimeline,
        };
      }

      return prev;
    });

    console.log("[useTimeline] UnifiedEvent update completed");
  }, []);

  // TimelineEventをUnifiedEventとして取得する機能
  const getUnifiedEvent = useCallback(
    (eventId: string): UnifiedEvent | null => {
      const timelineEvent = project.timeline.find((event) => event.id === eventId);
      return timelineEvent ? convertTimelineEventToUnifiedEvent(timelineEvent) : null;
    },
    [project.timeline]
  );

  // デバッグ情報を取得
  const getDebugInfo = useCallback(() => {
    return {
      currentFrame,
      lastAppliedFrame: lastAppliedFrameRef.current,
      stateEventsCount: project.stateEvents.length,
      timelineEventsCount: project.timeline.length,
      project,
      stateManagerDebug: getStateManagerDebugInfo(),
    };
  }, [currentFrame, project, getStateManagerDebugInfo]);

  // 特定時刻でのデバッグ情報
  const getDebugAtFrame = useCallback(
    async (frame: number) => {
      if (!stateManager) return null;
      return await debugStateCalculation(frame);
    },
    [stateManager, debugStateCalculation]
  );

  return {
    project,
    setProject,
    isPlaying,
    seekTo,
    play,
    pause,
    addEvent,
    insertEvent,
    updateEvent,
    addStateEvent,
    removeStateEvent,
    captureCurrentState,
    addContinuousEvent,
    removeEvent,
    clearCache,
    getDebugInfo,
    getDebugAtFrame,
    updateUnifiedEvent,
    getUnifiedEvent,
    stateManager,
    currentFrame,
  };
};
