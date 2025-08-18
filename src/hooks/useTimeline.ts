import { useState, useCallback, useRef, useMemo } from "react";
import type { Calculator } from "../types/desmos";
import type {
  TimelineEvent,
  StateEvent,
  ContinuousEvent,
  AnimationProject,
} from "../types/timeline";
import { StateManager } from "../utils/stateManager";

export const useTimeline = (calculator: Calculator | null) => {
  const [project, setProject] = useState<AnimationProject>({
    initialState: {
      expressions: [
        { id: "1", latex: "x^2", hidden: false },
        { id: "2", latex: "y=x+1", hidden: true },
      ],
      mathBounds: { left: -10, right: 10, top: 10, bottom: -10 },
      settings: {},
    },
    timeline: [
      { id: "1", time: 2, action: "setHidden", args: { id: "1", hidden: true } },
      { id: "2", time: 3, action: "setHidden", args: { id: "2", hidden: false } },
      {
        id: "3",
        time: 5,
        action: "setMathBounds",
        args: { left: -5, right: 5, top: 5, bottom: -5 },
      },
    ],
    stateEvents: [], // 新しいstateEvents配列
    continuousEvents: [],
    duration: 10,
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);

  // StateManagerのインスタンスを作成・管理
  const stateManager = useMemo(() => {
    return new StateManager(
      project.initialState,
      project.timeline,
      project.stateEvents,
      project.continuousEvents
    );
  }, [project.initialState, project.timeline, project.stateEvents, project.continuousEvents]);

  // プロジェクトの参照を安定化
  const projectRef = useRef(project);
  projectRef.current = project;

  // 最後に適用されたstateの時刻を追跡
  const lastAppliedTimeRef = useRef<number>(-1);

  // 特定の時刻に移動（新しい計算済み領域方式）
  const seekTo = useCallback(
    (time: number) => {
      if (!calculator) return;

      setCurrentTime(time);

      try {
        // 計算済み領域内かチェック
        if (!stateManager.isTimeCalculated(time)) {
          console.warn(
            `Time ${time}s is not in calculated region. Available regions:`,
            stateManager.getCalculatedRegions()
          );
          return;
        }

        // StateManagerから指定時刻のstateを取得
        const targetState = stateManager.getStateAtTime(time);

        // calculatorにstateを適用
        stateManager.applyStateToCalculator(targetState, calculator);

        lastAppliedTimeRef.current = time;

        console.log(`Seeked to ${time}s`, {
          cacheInfo: stateManager.getCacheInfo(),
          maxCalculatedTime: stateManager.getMaxCalculatedTime(),
          appliedState: targetState,
        });
      } catch (error) {
        console.error(`Failed to seek to ${time}s:`, error);
        // エラーの場合は最も近い計算済み時刻に移動
        const regions = stateManager.getCalculatedRegions();
        if (regions.length > 0) {
          const nearestTime = Math.min(time, Math.max(...regions.map((r) => r.end - 0.1)));
          if (nearestTime !== time) {
            setCurrentTime(nearestTime);
            console.log(`Adjusted seek to nearest calculated time: ${nearestTime}s`);
          }
        }
      }
    },
    [calculator, stateManager]
  );

  // 改善されたアニメーション再生（新しい計算済み領域方式）
  const play = useCallback(() => {
    if (!calculator || isPlaying) return;

    setIsPlaying(true);
    const startTime = Date.now();
    const initialTime = currentTime;

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const newTime = initialTime + elapsed;
      const currentProject = projectRef.current;

      if (newTime >= currentProject.duration) {
        setCurrentTime(currentProject.duration);
        setIsPlaying(false);

        // 最終時刻が計算済み領域内かチェックして適用
        try {
          if (stateManager.isTimeCalculated(currentProject.duration)) {
            const finalState = stateManager.getStateAtTime(currentProject.duration);
            stateManager.applyStateToCalculator(finalState, calculator);
            lastAppliedTimeRef.current = currentProject.duration;
          } else {
            console.warn(`Final time ${currentProject.duration}s is not in calculated region`);
          }
        } catch (error) {
          console.error("Failed to apply final state:", error);
        }
        return;
      }

      setCurrentTime(newTime);

      // 現在時刻が計算済み領域内かチェック
      if (!stateManager.isTimeCalculated(newTime)) {
        // 計算済み領域を拡張してみる
        try {
          const regions = stateManager.getCalculatedRegions();
          const hasInfiniteRegion = regions.some((r) => r.end === Infinity);

          if (!hasInfiniteRegion) {
            const maxCalculatedTime = stateManager.getMaxCalculatedTime();
            if (newTime > maxCalculatedTime) {
              // maxCalculatedTimeから newTime まで計算を拡張
              console.log(`Extending calculation from ${maxCalculatedTime}s to ${newTime}s`);
              stateManager.calculateFromTime(maxCalculatedTime, newTime);
            }
          } else {
            console.warn(
              `Infinite region exists, but time ${newTime}s is not calculated. This should not happen.`
            );
          }
        } catch (error) {
          console.warn(`Failed to extend calculation to ${newTime}s:`, error);
          setIsPlaying(false);
          return;
        }

        // 再度チェック
        if (!stateManager.isTimeCalculated(newTime)) {
          console.warn(
            `Time ${newTime}s is still not in calculated region after extension, pausing playback`
          );
          setIsPlaying(false);
          return;
        }
      }

      // 状態適用の頻度制御
      const updateThreshold = 0.033; // 30fps
      const timeDiff = Math.abs(newTime - lastAppliedTimeRef.current);

      if (timeDiff >= updateThreshold) {
        try {
          const currentState = stateManager.getStateAtTime(newTime);
          stateManager.applyStateToCalculator(currentState, calculator);
          lastAppliedTimeRef.current = newTime;
        } catch (error) {
          console.warn("Failed to apply state during playback:", error);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [calculator, isPlaying, currentTime, stateManager]);

  // StateEventを追加
  const addStateEvent = useCallback(
    (time: number, description?: string) => {
      if (!calculator) return null;

      const stateEvent = stateManager.createStateEventFromCalculator(time, calculator, description);

      setProject((prev) => ({
        ...prev,
        stateEvents: [...prev.stateEvents, stateEvent].sort((a, b) => a.time - b.time),
      }));

      console.log(`State event added at ${time}s:`, stateEvent);
      return stateEvent;
    },
    [calculator, stateManager]
  );

  // StateEventを削除
  const removeStateEvent = useCallback(
    (eventId: string) => {
      stateManager.removeStateEvent(eventId);

      setProject((prev) => ({
        ...prev,
        stateEvents: prev.stateEvents.filter((event) => event.id !== eventId),
      }));

      console.log(`State event removed: ${eventId}`);
    },
    [stateManager]
  );

  // 指定時刻まで計算を進める
  const calculateToTime = useCallback(
    (targetTime: number) => {
      if (!calculator) return;

      try {
        // 現在の時刻から targetTime まで計算
        stateManager.calculateFromTime(currentTime, targetTime);
        console.log(`Calculated from ${currentTime}s to ${targetTime}s`);
      } catch (error) {
        console.error(`Failed to calculate to ${targetTime}s:`, error);
      }
    },
    [calculator, currentTime, stateManager]
  );

  // 現在時刻でStateEventを作成
  const captureCurrentState = useCallback(
    (description?: string) => {
      return addStateEvent(
        currentTime,
        description || `Captured state at ${currentTime.toFixed(1)}s`
      );
    },
    [addStateEvent, currentTime]
  );

  // アニメーションを停止
  const pause = useCallback(() => {
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  // チェックポイントを作成
  const createCheckpoint = useCallback(
    (time: number) => {
      if (!calculator) return;

      stateManager.createCheckpoint(time, calculator);
      console.log(`Checkpoint created at ${time}s`, stateManager.getCacheInfo());
    },
    [calculator, stateManager]
  );

  // イベントを追加
  const addEvent = useCallback(
    (event: Omit<TimelineEvent, "id">) => {
      const newEvent: TimelineEvent = {
        ...event,
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      setProject((prev) => {
        const newProject = {
          ...prev,
          timeline: [...prev.timeline, newEvent].sort((a, b) => a.time - b.time),
        };

        // StateManagerを更新
        stateManager.updateTimeline(newProject.timeline);

        return newProject;
      });
    },
    [stateManager]
  );

  // 連続イベントを追加
  const addContinuousEvent = useCallback(
    (event: ContinuousEvent) => {
      setProject((prev) => {
        const newProject = {
          ...prev,
          continuousEvents: [...prev.continuousEvents, event],
        };

        // StateManagerを更新
        stateManager.updateContinuousEvents(newProject.continuousEvents);

        return newProject;
      });
    },
    [stateManager]
  );

  // イベントを削除
  const removeEvent = useCallback(
    (eventId: string) => {
      setProject((prev) => {
        const newProject = {
          ...prev,
          timeline: prev.timeline.filter((event) => event.id !== eventId),
        };

        // StateManagerを更新
        stateManager.updateTimeline(newProject.timeline);

        return newProject;
      });
    },
    [stateManager]
  );

  // 初期stateを更新
  const updateInitialState = useCallback(() => {
    if (!calculator) return;

    // 現在のcalculatorの状態をキャプチャして初期stateとして設定
    const currentState = {
      expressions: calculator.getExpressions().map((expr) => ({
        id: expr.id,
        latex: expr.latex,
        hidden: expr.hidden || false,
        color: expr.color || "#000000",
        lineStyle: expr.lineStyle,
        lineWidth: expr.lineWidth,
      })),
      mathBounds: calculator.graphpaperBounds.mathCoordinates,
      settings: {},
    };

    setProject((prev) => ({
      ...prev,
      initialState: currentState,
    }));

    stateManager.updateInitialState(currentState);
    console.log("Initial state updated", currentState);
  }, [calculator, stateManager]);

  // キャッシュをクリア
  const clearCache = useCallback(() => {
    stateManager.clearCache();
    console.log("Cache cleared");
  }, [stateManager]);

  // デバッグ情報を取得（新システム版）
  const getDebugInfo = useCallback(() => {
    return {
      currentTime,
      lastAppliedTime: lastAppliedTimeRef.current,
      cacheInfo: stateManager.getCacheInfo(),
      criticalTimes: stateManager.getCriticalTimes(),
      maxCalculatedTime: stateManager.getMaxCalculatedTime(),
      calculatedRegions: stateManager.getCalculatedRegions(),
      stateEventsCount: project.stateEvents.length,
      project,
    };
  }, [currentTime, stateManager, project]);

  // TimelineEventを編集
  const updateEvent = useCallback(
    (eventId: string, updates: Partial<Omit<TimelineEvent, "id">>) => {
      const success = stateManager.updateTimelineEvent(eventId, updates);
      if (success) {
        setProject((prev) => ({
          ...prev,
          timeline: stateManager.getTimelineEvents(),
        }));
        console.log(`Timeline event ${eventId} updated`, updates);
      }
      return success;
    },
    [stateManager]
  );

  // TimelineEventを挿入（より簡単な方法）
  const insertEvent = useCallback(
    (event: Omit<TimelineEvent, "id">) => {
      const newEvent = stateManager.addTimelineEvent(event);
      setProject((prev) => ({
        ...prev,
        timeline: stateManager.getTimelineEvents(),
      }));
      console.log(`Timeline event inserted:`, newEvent);
      return newEvent;
    },
    [stateManager]
  );

  return {
    project,
    setProject,
    currentTime,
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
    calculateToTime,
    addContinuousEvent,
    removeEvent,
    createCheckpoint,
    updateInitialState,
    clearCache,
    getDebugInfo,
    stateManager,
  };
};
