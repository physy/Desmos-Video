import React, { useState, useEffect, useCallback } from "react";
import type { StateManager } from "../utils/stateManager";
import type { DesmosState } from "../types/desmos";

interface CachePanelProps {
  stateManager?: StateManager | null;
}

interface CacheInfo {
  frame: number;
  hasState: boolean;
  hasScreenshot: boolean;
}

interface CachePreviewData {
  frame: number;
  state?: DesmosState;
  screenshot?: string;
}

export const CachePanel: React.FC<CachePanelProps> = ({ stateManager }) => {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());
  const [rangeStart, setRangeStart] = useState<number | "">(0);
  const [rangeEnd, setRangeEnd] = useState<number | "">(100);
  const [isSelectAll, setIsSelectAll] = useState(false);

  // プレビュー機能関連
  const [previewFrame, setPreviewFrame] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState<CachePreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // 全フレームキャッシュ作成状態
  const [isCreatingAllCache, setIsCreatingAllCache] = useState(false);
  const [cacheCreationProgress, setCacheCreationProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // キャッシュ情報を更新
  const updateCacheInfo = useCallback(async () => {
    if (!stateManager) {
      setCacheInfo([]);
      return;
    }

    const debugInfo = stateManager.getDebugInfo();
    const cachedFrames = debugInfo.cachedTimes || [];

    const info: CacheInfo[] = [];
    for (const frame of cachedFrames) {
      const hasScreenshot = !!(await stateManager.getScreenshotAtFrame(frame));
      info.push({
        frame,
        hasState: true, // キャッシュされているフレームは必ずstateを持つ
        hasScreenshot,
      });
    }

    info.sort((a, b) => a.frame - b.frame);
    setCacheInfo(info);
  }, [stateManager]);

  // コンポーネントマウント時とstateManager変更時に更新
  useEffect(() => {
    updateCacheInfo();
  }, [stateManager, updateCacheInfo]);

  // 定期的に更新（キャッシュが動的に変更されるため）
  useEffect(() => {
    const interval = setInterval(updateCacheInfo, 2000);
    return () => clearInterval(interval);
  }, [updateCacheInfo]);

  // プレビューデータを取得
  const loadPreviewData = useCallback(
    async (frame: number) => {
      if (!stateManager) return;

      setIsLoadingPreview(true);
      try {
        const state = await stateManager.getStateAtFrame(frame);
        const screenshot = await stateManager.getScreenshotAtFrame(frame);

        setPreviewData({
          frame,
          state,
          screenshot,
        });
      } catch (error) {
        console.error("Failed to load preview data:", error);
        setPreviewData({
          frame,
          state: undefined,
          screenshot: undefined,
        });
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [stateManager]
  );

  // プレビューを開く
  const handlePreview = (frame: number) => {
    setPreviewFrame(frame);
    loadPreviewData(frame);
  };

  // プレビューを閉じる
  const closePreview = () => {
    setPreviewFrame(null);
    setPreviewData(null);
    setIsLoadingPreview(false);
  };

  // 全選択の切り替え
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedFrames(new Set());
    } else {
      setSelectedFrames(new Set(cacheInfo.map((info) => info.frame)));
    }
    setIsSelectAll(!isSelectAll);
  };

  // 個別フレームの選択切り替え
  const handleFrameToggle = (frame: number) => {
    const newSelected = new Set(selectedFrames);
    if (newSelected.has(frame)) {
      newSelected.delete(frame);
    } else {
      newSelected.add(frame);
    }
    setSelectedFrames(newSelected);
    setIsSelectAll(newSelected.size === cacheInfo.length);
  };

  // 範囲選択
  const handleRangeSelect = () => {
    const start = typeof rangeStart === "number" ? rangeStart : parseInt(rangeStart as string) || 0;
    const end = typeof rangeEnd === "number" ? rangeEnd : parseInt(rangeEnd as string) || 0;

    const newSelected = new Set<number>();
    cacheInfo.forEach((info) => {
      if (info.frame >= start && info.frame <= end) {
        newSelected.add(info.frame);
      }
    });
    setSelectedFrames(newSelected);
    setIsSelectAll(newSelected.size === cacheInfo.length);
  };

  // 全キャッシュクリア
  const handleClearAll = () => {
    if (!stateManager) return;
    if (confirm("全てのキャッシュを削除しますか？")) {
      stateManager.clearCache();
      updateCacheInfo();
      setSelectedFrames(new Set());
      setIsSelectAll(false);
    }
  };

  // 選択されたフレームのキャッシュを削除
  const handleClearSelected = () => {
    if (!stateManager || selectedFrames.size === 0) return;
    if (confirm(`選択された ${selectedFrames.size} フレームのキャッシュを削除しますか？`)) {
      const deletedCount = stateManager.clearCacheForFrames(Array.from(selectedFrames));
      alert(`${deletedCount} フレームのキャッシュを削除しました。`);
      updateCacheInfo();
      setSelectedFrames(new Set());
      setIsSelectAll(false);
    }
  };

  // 全フレームキャッシュ作成
  const handleCreateAllFrameCache = async () => {
    if (!stateManager) return;

    if (
      !confirm("全フレームのキャッシュを作成します。既存のキャッシュは削除されます。続行しますか？")
    ) {
      return;
    }

    setIsCreatingAllCache(true);
    setCacheCreationProgress({ current: 0, total: 0 });

    try {
      await stateManager.createAllFrameCache((current, total) => {
        setCacheCreationProgress({ current, total });
      });

      alert("全フレームのキャッシュ作成が完了しました。");
      await updateCacheInfo();
    } catch (error) {
      console.error("Failed to create all frame cache:", error);
      alert(`キャッシュ作成に失敗しました: ${error}`);
    } finally {
      setIsCreatingAllCache(false);
      setCacheCreationProgress(null);
    }
  };

  const totalCacheSize = cacheInfo.length;
  const screenshotCacheSize = cacheInfo.filter((info) => info.hasScreenshot).length;

  return (
    <div className="p-2 bg-white rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">キャッシュ管理</h3>
        <button
          onClick={updateCacheInfo}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          更新
        </button>
      </div>

      {/* キャッシュ統計 */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            総キャッシュフレーム数: <span className="font-medium">{totalCacheSize}</span>
          </div>
          <div>
            スクリーンショット: <span className="font-medium">{screenshotCacheSize}</span>
          </div>
          <div>
            選択中: <span className="font-medium">{selectedFrames.size}</span>
          </div>
        </div>
      </div>

      {/* 操作ボタン */}
      <div className="mb-4 space-y-2">
        <div className="flex space-x-2">
          <button
            onClick={handleClearAll}
            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            disabled={totalCacheSize === 0}
          >
            全削除
          </button>
          <button
            onClick={handleClearSelected}
            className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
            disabled={selectedFrames.size === 0}
          >
            選択削除
          </button>
          <button
            onClick={handleCreateAllFrameCache}
            className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            disabled={isCreatingAllCache || !stateManager}
          >
            {isCreatingAllCache ? "作成中..." : "全フレーム作成"}
          </button>
        </div>

        {/* 全フレームキャッシュ作成プログレス */}
        {cacheCreationProgress && (
          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <div className="text-sm text-blue-800 mb-2">
              キャッシュ作成中: {cacheCreationProgress.current} / {cacheCreationProgress.total}{" "}
              フレーム
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width:
                    cacheCreationProgress.total > 0
                      ? `${(cacheCreationProgress.current / cacheCreationProgress.total) * 100}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        )}

        {/* 範囲選択 */}
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-gray-600">範囲選択:</span>
          <input
            type="number"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value === "" ? "" : parseInt(e.target.value))}
            className="w-16 px-2 py-1 border border-gray-300 rounded"
            placeholder="開始"
          />
          <span>～</span>
          <input
            type="number"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value === "" ? "" : parseInt(e.target.value))}
            className="w-16 px-2 py-1 border border-gray-300 rounded"
            placeholder="終了"
          />
          <button
            onClick={handleRangeSelect}
            className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            選択
          </button>
        </div>
      </div>

      {/* 全選択チェックボックス */}
      {totalCacheSize > 0 && (
        <div className="mb-2">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={isSelectAll}
              onChange={handleSelectAll}
              className="rounded"
            />
            <span>全選択</span>
          </label>
        </div>
      )}

      {/* キャッシュリスト */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded">
        {totalCacheSize === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">キャッシュはありません</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {cacheInfo.map((info) => (
              <div
                key={info.frame}
                className={`p-2 flex items-center justify-between hover:bg-gray-50 ${
                  selectedFrames.has(info.frame) ? "bg-blue-50" : ""
                }`}
              >
                <label className="flex items-center space-x-2 text-sm flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFrames.has(info.frame)}
                    onChange={() => handleFrameToggle(info.frame)}
                    className="rounded"
                  />
                  <span className="font-medium">フレーム {info.frame}</span>
                </label>
                <div className="flex space-x-2 text-xs items-center">
                  <span
                    className={`px-2 py-1 rounded ${
                      info.hasState ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    State
                  </span>
                  <span
                    className={`px-2 py-1 rounded ${
                      info.hasScreenshot ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    Shot
                  </span>
                  <button
                    onClick={() => handlePreview(info.frame)}
                    className="px-2 py-1 bg-purple-100 text-purple-800 rounded hover:bg-purple-200 transition-colors"
                    title="プレビュー"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      role="img"
                      aria-label="eye outline"
                    >
                      <title>Eye (outline)</title>
                      <path
                        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* プレビューモーダル */}
      {previewFrame !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                フレーム {previewFrame} キャッシュプレビュー
              </h3>
              <button
                onClick={closePreview}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* コンテンツ */}
            <div className="flex-1 overflow-auto p-4">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">読み込み中...</div>
                </div>
              ) : previewData ? (
                <div className="space-y-6">
                  {/* スクリーンショット */}
                  {previewData.screenshot && (
                    <div>
                      <h4 className="text-md font-medium mb-2">スクリーンショット</h4>
                      <div className="border border-gray-300 rounded-lg overflow-hidden">
                        <img
                          src={previewData.screenshot}
                          alt={`Frame ${previewFrame} screenshot`}
                          className="max-w-full h-auto"
                          style={{ maxHeight: "300px" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 状態情報 */}
                  {previewData.state && (
                    <div>
                      <h4 className="text-md font-medium mb-2">状態情報</h4>
                      <div className="bg-gray-50 border border-gray-300 rounded-lg">
                        {/* 基本情報 */}
                        <div className="p-3 border-b border-gray-200">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">バージョン:</span>{" "}
                              <span className="font-medium">{previewData.state.version}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">式の数:</span>{" "}
                              <span className="font-medium">
                                {previewData.state.expressions?.list?.length || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ビューポート情報 */}
                        <div className="p-3 border-b border-gray-200">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">ビューポート</h5>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              x: [{previewData.state.graph.viewport.xmin.toFixed(2)},{" "}
                              {previewData.state.graph.viewport.xmax.toFixed(2)}]
                            </div>
                            <div>
                              y: [{previewData.state.graph.viewport.ymin.toFixed(2)},{" "}
                              {previewData.state.graph.viewport.ymax.toFixed(2)}]
                            </div>
                          </div>
                        </div>

                        {/* 式リスト */}
                        {previewData.state.expressions?.list &&
                          previewData.state.expressions.list.length > 0 && (
                            <div className="p-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">式一覧</h5>
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {previewData.state.expressions.list
                                  .slice(0, 10)
                                  .map((expr, index) => (
                                    <div
                                      key={index}
                                      className="text-xs bg-white p-2 rounded border"
                                    >
                                      <div className="font-medium text-gray-700">ID: {expr.id}</div>
                                      <div className="text-gray-600 mt-1 font-mono break-all">
                                        {expr.latex || "No LaTeX"}
                                      </div>
                                    </div>
                                  ))}
                                {previewData.state.expressions.list.length > 10 && (
                                  <div className="text-xs text-gray-500 text-center py-2">
                                    ... と他 {previewData.state.expressions.list.length - 10} 件
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* RAWデータ */}
                  <div>
                    <h4 className="text-md font-medium mb-2">RAWデータ</h4>
                    <div className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-auto">
                      <pre className="text-xs whitespace-pre-wrap">
                        {JSON.stringify(previewData.state, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">データが見つかりません</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
