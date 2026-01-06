# TRPG Chat Game

Next.js (App Router)、Tailwind CSS、OpenRouter APIを使用したブラウザで遊べるTRPG風チャットゲームです。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
NEXT_PUBLIC_OPENROUTER_API_KEY=your_api_key_here
```

OpenRouter APIキーは [https://openrouter.ai/keys](https://openrouter.ai/keys) から取得できます。

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 機能

- **世界観選択**: 学園、SF、ファンタジーの3つの世界観から選択
- **AIプレイヤー**: カイト（男性、粗野）とユキ（女性、冷静）が自動で会話に参加
- **GM**: AIがゲームマスターとして物語を進行
- **リアルタイムチャット**: テーブルトークとフィールド描写がリアルタイムで更新

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- OpenRouter API (mythomax-l2-13b)

## プロジェクト構造

```
app/
  ├── api/game/          # OpenRouter API呼び出し用のAPI Route
  ├── components/        # Reactコンポーネント
  │   ├── GameScreen.tsx      # メインゲーム画面
  │   ├── GameStartScreen.tsx # ゲーム開始画面
  │   ├── GameField.tsx       # フィールド表示
  │   ├── TableTalk.tsx       # テーブルトーク表示
  │   └── GameOptions.tsx     # 選択肢表示
  ├── lib/               # ユーティリティ関数
  │   └── openrouter.ts  # OpenRouter API通信ロジック
  ├── types/             # TypeScript型定義
  │   └── game.ts
  ├── globals.css        # グローバルスタイル
  ├── layout.tsx         # ルートレイアウト
  └── page.tsx           # メインページ
```


