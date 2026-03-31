# AI Nikki — スマート日記アシスタント

> 「今日をめくる → 書く → 過去の自分と比べる」

日めくりカレンダーをめくる行為がアプリの起点。1日1ページの気軽さで書き続けると、いつの間にか自分だけの記録集が完成する。

## 🚀 起動方法

```bash
npx --yes serve -l 3000
```

ブラウザで `http://localhost:3000/app.html` を開く。

## ✨ 機能（Phase 1）

| 機能 | 説明 |
|------|------|
| 日めくりカレンダー | フリップアニメーション付き。今日の日付を大きく表示 |
| 気分スタンプ | 5段階（最高/いい感じ/ふつう/ちょっと…/つらい）、選択アニメーション付き |
| 日記テキスト | 罫線付きノート風テキストエリア（Klee One フォント） |
| 写真添付 | カメラ撮影/ギャラリー対応。Canvas で max 800px に自動圧縮 |
| 積み上げトラッカー | 読書・運動・勉強の3カテゴリ。トグル表示 |
| 保存機能 | localStorage に永続保存。リップル + トースト演出 |
| ストリーク | 連続記録日数を炎アニメーションで表示 |
| EXP & レベル | 日記保存・写真・積み上げで EXP 獲得。レベルアップ演出 |
| バッジ | 初投稿・7日連続などの実績バッジをモーダルで解放 |
| 月間カレンダー | 気分カラーのドットで記録済み日を可視化 |
| タイムトラベルカード | 1ヶ月前/1年前の日記を自動表示 |
| PWA 対応 | オフライン動作、ホーム画面追加 |

## 🛠 技術スタック

- HTML5 + CSS3 + JavaScript (ES Modules)
- Anthropic Claude API（Phase 2〜）
- localStorage（全データ保存）
- Service Worker（PWA/オフライン）
- Google Fonts（Zen Maru Gothic / Noto Sans JP / Klee One）

## 📂 ファイル構成

```
ai-nikki/
├── app.html              # メインアプリ（SPA）
├── manifest.json         # PWA マニフェスト
├── service-worker.js     # Service Worker
├── css/
│   ├── styles.css        # デザインシステム + 全スタイル
│   └── animations.css    # アニメーション定義
├── js/
│   ├── app.js            # メインロジック・画面遷移
│   ├── diary.js          # 日記 CRUD
│   ├── mood.js           # 気分スタンプ管理
│   ├── photo.js          # 写真添付・圧縮
│   ├── accumulation.js   # 積み上げトラッカー
│   ├── gamification.js   # レベル・EXP・ストリーク・バッジ
│   └── storage.js        # localStorage ヘルパー
└── assets/
    └── icons/            # PWA アイコン
```

## 🗺 ロードマップ

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | 日めくりホーム・保存・ゲーミフィケーション基盤 | ✅ 完了 |
| 2 | カレンダー詳細 + タイムトラベル + AI 感情分析 | 🔜 |
| 3 | AI 深堀りチャット + 週次レポート | 🔜 |
| 4 | テーマ切替 + バッジ演出強化 + PWA 完全対応 | 🔜 |
| 5 | Year in Review（Spotify Wrapped 風） | 🔜 |

## 📝 データ保存先

すべてのデータはブラウザの `localStorage` に保存されます。エクスポート機能（Phase 4）で JSON バックアップが可能です。
