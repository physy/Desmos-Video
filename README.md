# Desmos Animation Studio

Desmos Graphing Calculator API を使用した数式アニメーション作成ツールです。教育用動画コンテンツの制作に特化した機能を提供します。

## 🎯 主な機能

- **タイムライン編集**: スクラブバーで再生/停止/シーク操作
- **カメラ制御**: パン・ズームのアニメーション
- **イベント管理**: 離散的・連続的イベントの登録と実行
- **エクスポート**: 画像や動画の出力（予定）
- **自動スクリプト実行**: JS コードで Desmos API を操作（予定）

## 🚀 技術スタック

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Tailwind CSS + Lucide React
- **API**: Desmos Graphing Calculator API
- **Build Tool**: Vite
- **Future**: Electron 化を検討中

## 📦 セットアップ

### 前提条件

- Node.js 18 以上
- npm または yarn

### インストール

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

### ビルド

```bash
# プロダクションビルド
npm run build

# プレビュー
npm run preview
```

## 🎬 使い方

1. **基本操作**

   - アプリケーションを起動すると、Desmos グラフと基本的な sin/cos 関数が表示されます
   - 「デモイベント追加」ボタンでサンプルアニメーションを体験できます

2. **タイムライン操作**

   - 下部のスクラブバーで時間をコントロール
   - 再生ボタンでアニメーション実行
   - 黄色のマーカーはイベントの発生時刻を表示

3. **イベント管理**
   - 右側パネルでタイムラインイベントを確認
   - 各イベントの詳細情報を表示

## 🎨 アーキテクチャ

### ディレクトリ構造

```
src/
  components/      # Reactコンポーネント
    DesmosGraph.tsx       # Desmosグラフ表示
    TimelineControls.tsx  # タイムライン操作UI
  hooks/           # カスタムフック
    useTimeline.ts        # タイムライン管理ロジック
  types/           # TypeScript型定義
    desmos.ts             # Desmos API型
    timeline.ts           # タイムライン関連型
  utils/           # ユーティリティ関数
```

### データ構造

#### TimelineEvent（離散イベント）

```typescript
{
  time: number; // 発生時刻（秒）
  action: string; // アクション名
  args: Record<string, unknown>; // パラメータ
}
```

#### ContinuousEvent（連続イベント）

```typescript
{
  startTime: number;   // 開始時刻
  duration: number;    // 持続時間
  variable: string;    // 変更する変数
  startValue: number;  // 開始値
  endValue: number;    // 終了値
  easingFunction?: (t: number) => number; // イージング関数
}
```

## 🔮 今後の計画

### Phase 1: 基本機能の完成

- [x] 基本的なタイムライン機能
- [x] Desmos グラフとの連携
- [ ] イベント追加・編集 UI
- [ ] より多くのアクション対応

### Phase 2: 高度な機能

- [ ] カメラアニメーション
- [ ] 連続イベントの実装
- [ ] チェックポイントシステム
- [ ] カスタムスクリプト実行

### Phase 3: エクスポート機能

- [ ] 静止画エクスポート（calculator.screenshot）
- [ ] 連番画像出力
- [ ] FFmpeg 連携による動画生成
- [ ] MediaRecorder によるリアルタイム録画

### Phase 4: プロダクション対応

- [ ] Electron 化
- [ ] ファイル I/O（プロジェクト保存・読込）
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング強化

## 📄 ライセンス

MIT License

## 🙏 謝辞

- [Desmos](https://www.desmos.com/) - 素晴らしいグラフ計算機 API
- [Vite](https://vitejs.dev/) - 高速な開発環境
- [React](https://reactjs.org/) - UI ライブラリ
- [Tailwind CSS](https://tailwindcss.com/) - スタイリング
