import { useCallback, useRef, useState, useEffect } from "react";
import { deepCopy } from "../utils/deepCopy";
import type { AnimationProject } from "../types/timeline";

const LOCAL_STORAGE_KEY = "desmos-animation-project";
const HISTORY_STORAGE_KEY = "desmos-animation-project-history";
const MAX_HISTORY_SIZE = 50; // 履歴の最大サイズ

export interface ProjectHistoryState {
  project: AnimationProject;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  updateProject: (project: AnimationProject) => void;
  applyProject: (project: AnimationProject) => void;
  saveToStorage: () => void;
  loadFromStorage: () => AnimationProject | null;
  clearHistory: () => void;
}

/**
 * プロジェクト履歴管理とローカルストレージ統合のカスタムフック
 */
export function useProjectHistory(
  initialProject: AnimationProject,
  onProjectChange?: (project: AnimationProject) => void
): ProjectHistoryState {
  // 履歴スタック
  const [history, setHistory] = useState<AnimationProject[]>([deepCopy(initialProject)]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 現在のプロジェクト
  const [project, setProject] = useState<AnimationProject>(() => {
    // 初期化時にローカルストレージから読み込み
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsedProject = JSON.parse(saved) as AnimationProject;
        console.log("プロジェクトをローカルストレージから復元しました:", parsedProject);
        return parsedProject;
      }
    } catch (error) {
      console.warn("ローカルストレージからの読み込みに失敗:", error);
    }
    return deepCopy(initialProject);
  });

  // Undo/Redoスキップフラグ
  const skipHistory = useRef(false);

  // 自動保存のデバウンス用
  const saveTimeoutRef = useRef<number | null>(null);

  // プロジェクトの更新
  const updateProject = useCallback(
    (newProject: AnimationProject) => {
      setProject((prevProject) => {
        // 変更がない場合はスキップ
        if (JSON.stringify(prevProject) === JSON.stringify(newProject)) {
          return prevProject;
        }

        const projectCopy = deepCopy(newProject);

        // Undo/Redo操作の場合は履歴に追加しない
        if (skipHistory.current) {
          skipHistory.current = false;
          return projectCopy;
        }

        // 履歴に追加
        setHistory((prevHistory) => {
          const newHistory = prevHistory.slice(0, currentIndex + 1);
          newHistory.push(projectCopy);

          // 履歴サイズ制限
          if (newHistory.length > MAX_HISTORY_SIZE) {
            return newHistory.slice(1);
          }
          return newHistory;
        });

        setCurrentIndex((prevIndex) => {
          const newIndex = Math.min(prevIndex + 1, MAX_HISTORY_SIZE - 1);
          return newIndex;
        });

        // 自動保存（デバウンス）
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = window.setTimeout(() => {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectCopy));
            console.log("プロジェクトを自動保存しました");
          } catch (error) {
            console.warn("自動保存に失敗:", error);
          }
        }, 1000);

        return projectCopy;
      });
    },
    [currentIndex]
  );

  // 履歴も初期化時にローカルストレージから復元
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory) as {
          history: AnimationProject[];
          currentIndex: number;
        };
        setHistory(parsedHistory.history);
        setCurrentIndex(parsedHistory.currentIndex);
        console.log("履歴をローカルストレージから復元しました");
      }
    } catch (error) {
      console.warn("履歴の読み込みに失敗:", error);
    }
  }, []);

  // 履歴の自動保存
  useEffect(() => {
    try {
      const historyData = { history, currentIndex };
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyData));
    } catch (error) {
      console.warn("履歴の保存に失敗:", error);
    }
  }, [history, currentIndex]);

  // Undo操作
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const prevProject = history[newIndex];

      skipHistory.current = true;
      const restoredProject = deepCopy(prevProject);
      setProject(restoredProject);
      setCurrentIndex(newIndex);

      // コールバック呼び出し
      if (onProjectChange) {
        onProjectChange(restoredProject);
      }

      console.log(`Undo実行: インデックス ${currentIndex} → ${newIndex}`);
    }
  }, [currentIndex, history, onProjectChange]);

  // Redo操作
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      const nextProject = history[newIndex];

      skipHistory.current = true;
      const restoredProject = deepCopy(nextProject);
      setProject(restoredProject);
      setCurrentIndex(newIndex);

      // コールバック呼び出し
      if (onProjectChange) {
        onProjectChange(restoredProject);
      }

      console.log(`Redo実行: インデックス ${currentIndex} → ${newIndex}`);
    }
  }, [currentIndex, history, onProjectChange]);

  // 手動保存
  const saveToStorage = useCallback(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(project));
      console.log("プロジェクトを手動保存しました");
    } catch (error) {
      console.warn("手動保存に失敗:", error);
      throw error;
    }
  }, [project]);

  // ローカルストレージから読み込み
  const loadFromStorage = useCallback((): AnimationProject | null => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsedProject = JSON.parse(saved) as AnimationProject;
        console.log("プロジェクトをローカルストレージから読み込みました");
        return parsedProject;
      }
      return null;
    } catch (error) {
      console.warn("ローカルストレージからの読み込みに失敗:", error);
      return null;
    }
  }, []);

  // 履歴クリア
  const clearHistory = useCallback(() => {
    setHistory([deepCopy(project)]);
    setCurrentIndex(0);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      console.log("履歴をクリアしました");
    } catch (error) {
      console.warn("履歴クリアに失敗:", error);
    }
  }, [project]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Z (Windows) または Cmd+Z (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      // Ctrl+Y (Windows) または Cmd+Shift+Z (Mac)
      else if (
        ((event.ctrlKey || event.metaKey) && event.key === "y") ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "z")
      ) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [undo, redo]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // プロジェクトを直接適用（履歴に追加しない）
  const applyProject = useCallback(
    (newProject: AnimationProject) => {
      skipHistory.current = true;
      const appliedProject = deepCopy(newProject);
      setProject(appliedProject);

      // コールバック呼び出し
      if (onProjectChange) {
        onProjectChange(appliedProject);
      }

      console.log("プロジェクトを適用しました:", appliedProject);
    },
    [onProjectChange]
  );

  return {
    project,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    undo,
    redo,
    updateProject,
    applyProject,
    saveToStorage,
    loadFromStorage,
    clearHistory,
  };
}
