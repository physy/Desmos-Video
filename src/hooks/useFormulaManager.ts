import { useState, useCallback, useRef } from "react";
import type { FormulaElement, SubtitleElement, FormulaEvent } from "../types/formula";

interface UseFormulaManagerProps {
  initialFormulas?: FormulaElement[];
  initialSubtitles?: SubtitleElement[];
}

export const useFormulaManager = ({
  initialFormulas = [],
  initialSubtitles = [],
}: UseFormulaManagerProps = {}) => {
  const [formulas, setFormulas] = useState<FormulaElement[]>(initialFormulas);
  const [subtitles, setSubtitles] = useState<SubtitleElement[]>(initialSubtitles);
  const idCounterRef = useRef(1);

  // 新しいIDを生成
  const generateId = useCallback(() => {
    return `formula_${Date.now()}_${idCounterRef.current++}`;
  }, []);

  // 数式を追加
  const addFormula = useCallback(
    (formula: Omit<FormulaElement, "id">) => {
      const newFormula: FormulaElement = {
        ...formula,
        id: generateId(),
      };
      setFormulas((prev) => [...prev, newFormula]);
      return newFormula;
    },
    [generateId]
  );

  // 字幕を追加
  const addSubtitle = useCallback(
    (subtitle: Omit<SubtitleElement, "id">) => {
      const newSubtitle: SubtitleElement = {
        ...subtitle,
        id: generateId(),
      };
      setSubtitles((prev) => [...prev, newSubtitle]);
      return newSubtitle;
    },
    [generateId]
  );

  // 要素を更新（汎用）
  const updateElement = useCallback((element: FormulaElement | SubtitleElement) => {
    if ("content" in element) {
      // 数式の場合
      setFormulas((prev) =>
        prev.map((f) => (f.id === element.id ? (element as FormulaElement) : f))
      );
    } else {
      // 字幕の場合
      setSubtitles((prev) =>
        prev.map((s) => (s.id === element.id ? (element as SubtitleElement) : s))
      );
    }
  }, []);

  // 要素を削除
  const deleteElement = useCallback((elementId: string) => {
    setFormulas((prev) => prev.filter((f) => f.id !== elementId));
    setSubtitles((prev) => prev.filter((s) => s.id !== elementId));
  }, []);

  // 指定フレームで表示される要素を取得
  const getElementsAtFrame = useCallback(
    (frame: number) => {
      const visibleFormulas = formulas.filter((f) => {
        if (!f.visible) return false;

        const startFrame = f.frame;
        const animation = f.animation;

        if (!animation || animation.type === "none") {
          return frame >= startFrame;
        }

        const animationStartFrame = startFrame + (animation.delay || 0);
        const animationEndFrame = animationStartFrame + animation.duration;

        return frame >= animationStartFrame;
      });

      const visibleSubtitles = subtitles.filter((s) => {
        if (!s.visible) return false;

        const startFrame = s.frame;
        const animation = s.animation;

        if (!animation || animation.type === "none") {
          return frame >= startFrame;
        }

        const animationStartFrame = startFrame + (animation.delay || 0);
        const animationEndFrame = animationStartFrame + animation.duration;

        return frame >= animationStartFrame;
      });

      return { formulas: visibleFormulas, subtitles: visibleSubtitles };
    },
    [formulas, subtitles]
  );

  // 要素を複製
  const duplicateElement = useCallback(
    (elementId: string) => {
      const formula = formulas.find((f) => f.id === elementId);
      if (formula) {
        const { id, ...formulaWithoutId } = formula;
        const duplicated = {
          ...formulaWithoutId,
          frame: formula.frame + 30, // 1秒後（30fps想定）
        };
        return addFormula(duplicated);
      }

      const subtitle = subtitles.find((s) => s.id === elementId);
      if (subtitle) {
        const { id, ...subtitleWithoutId } = subtitle;
        const duplicated = {
          ...subtitleWithoutId,
          frame: subtitle.frame + 30,
        };
        return addSubtitle(duplicated);
      }

      return null;
    },
    [formulas, subtitles, addFormula, addSubtitle]
  );

  // 全要素をクリア
  const clearAll = useCallback(() => {
    setFormulas([]);
    setSubtitles([]);
  }, []);

  // データをエクスポート
  const exportData = useCallback(() => {
    return {
      formulas,
      subtitles,
      version: "1.0",
    };
  }, [formulas, subtitles]);

  // データをインポート
  const importData = useCallback(
    (data: { formulas: FormulaElement[]; subtitles: SubtitleElement[]; version?: string }) => {
      setFormulas(data.formulas || []);
      setSubtitles(data.subtitles || []);
    },
    []
  );

  // 要素の時間をシフト
  const shiftElementTimes = useCallback((startFrame: number, shiftAmount: number) => {
    setFormulas((prev) =>
      prev.map((f) =>
        f.frame >= startFrame ? { ...f, frame: Math.max(0, f.frame + shiftAmount) } : f
      )
    );
    setSubtitles((prev) =>
      prev.map((s) =>
        s.frame >= startFrame ? { ...s, frame: Math.max(0, s.frame + shiftAmount) } : s
      )
    );
  }, []);

  return {
    // データ
    formulas,
    subtitles,

    // 操作
    addFormula,
    addSubtitle,
    updateElement,
    deleteElement,
    duplicateElement,
    clearAll,

    // ユーティリティ
    getElementsAtFrame,
    exportData,
    importData,
    shiftElementTimes,
  };
};
