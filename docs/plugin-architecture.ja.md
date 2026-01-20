# GUIChat プラグインアーキテクチャ

このドキュメントでは、GUIChat/MulmoChat プラグインシステムの思想、概要、アーキテクチャについて説明します。

## 目次

1. [設計思想](#設計思想)
2. [アーキテクチャ概要](#アーキテクチャ概要)
3. [gui-chat-protocol パッケージ](#gui-chat-protocol-パッケージ)
4. [プラグイン構造](#プラグイン構造)
5. [型システム](#型システム)
6. [バックエンド抽象化](#バックエンド抽象化)
7. [外部入力ハンドラー](#外部入力ハンドラー)
8. [将来の拡張](#将来の拡張)

---

## 設計思想

### 核となる原則

GUIChat プラグインシステムは、以下の原則に基づいて設計されています。

#### 1. フレームワーク非依存（Framework Agnostic）

プラグインのコアロジックは、特定の UI フレームワーク（Vue、React、Svelte 等）に依存しません。

```
プラグイン = コアロジック（フレームワーク非依存） + UI アダプター（フレームワーク固有）
```

**理由:**
- 他のプロジェクトで再利用可能
- UI フレームワークの変更に強い
- テストが容易

#### 2. 責務の分離（Separation of Concerns）

各レイヤーは明確な責務を持ちます。

| レイヤー | 責務 | 例 |
|---------|------|-----|
| **プラグイン** | ツール結果から UI を表示、プラグイン固有の設定 | クイズ表示、画像生成 |
| **アプリ層** | バックエンド設定管理、プラグインへのサービス提供 | API キー管理、バックエンド選択 |
| **バックエンドサービス** | 外部 API のラッパー | OpenAI、Google Maps、Exa |
| **サーバー** | 既存 API の提供 | 認証、プロキシ |

#### 3. 宣言的なインターフェース

プラグインは「何ができるか」を宣言し、「どう実現するか」はアプリ層に委ねます。

```typescript
// プラグインは種別のみを宣言
backends: ["textLLM"],  // テキスト生成 LLM を使用

// 具体的なプロバイダ選択はアプリ層が管理
// Claude か Gemini かは設定画面でユーザーが選択
```

#### 4. 型安全性（Type Safety）

すべてのインターフェースは TypeScript で厳密に型定義されています。

```typescript
// 型パラメータで明確に定義
ToolPlugin<T, J, A>
//        │  │  └── A: 引数の型
//        │  └───── J: LLM に返すデータの型
//        └──────── T: UI 用データの型
```

---

## アーキテクチャ概要

### 全体像

```
┌─────────────────────────────────────────────────────────────┐
│                      ホストアプリ                            │
│                   (MulmoChat, etc.)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Plugin A  │  │   Plugin B  │  │   Plugin C  │        │
│  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │        │
│  │  │ Core  │  │  │  │ Core  │  │  │  │ Core  │  │        │
│  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │        │
│  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │        │
│  │  │  Vue  │  │  │  │  Vue  │  │  │  │  Vue  │  │        │
│  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    gui-chat-protocol                        │
│            (共通型定義・インターフェース)                     │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

```
ユーザー入力 → LLM → ツール呼び出し → execute() → ToolResult → View/Preview
     ↑                                                              │
     └──────────────── instructions で LLM に指示 ←──────────────────┘
```

1. **ユーザー入力**: 音声またはテキストで指示
2. **LLM 処理**: どのツールを使うか判断
3. **ツール呼び出し**: プラグインの `execute()` 関数を実行
4. **ToolResult**: 実行結果を返却
5. **UI 表示**: View/Preview コンポーネントで結果を表示
6. **LLM への指示**: `instructions` で次のアクションを指示

### コンポーネントの役割

```
┌─────────────────────────────────────────────────────┐
│                    MulmoChat UI                      │
├──────────────┬──────────────────────────────────────┤
│   Sidebar    │              Canvas                   │
│              │                                       │
│ ┌──────────┐ │   ┌─────────────────────────────┐    │
│ │ Preview  │ │   │                             │    │
│ │ サムネイル │◄──┤         View                │    │
│ └──────────┘ │   │      メイン表示              │    │
│ ┌──────────┐ │   │   インタラクティブ操作可能   │    │
│ │ Preview  │ │   │                             │    │
│ └──────────┘ │   └─────────────────────────────┘    │
└──────────────┴──────────────────────────────────────┘
```

| コンポーネント | 役割 | Props |
|---------------|------|-------|
| **Preview** | サイドバーに表示する小さなサムネイル | `result: ToolResult` |
| **View** | キャンバスに表示するフルサイズ UI | `selectedResult: ToolResult`, `sendTextMessage: Function` |

---

## gui-chat-protocol パッケージ

### 概要

`gui-chat-protocol` は、GUIChat プラグインの標準プロトコルを定義する TypeScript ライブラリです。

```bash
npm install gui-chat-protocol
```

### パッケージ構成

```
gui-chat-protocol/
├── index.ts    # Core: ToolPluginCore, ToolContext, ToolResult, etc.
├── vue.ts      # Vue: ToolPluginVue, ToolPlugin (alias)
└── react.ts    # React: ToolPluginReact
```

### エクスポートの分類

| エクスポート元 | 内容 | 依存 |
|---------------|------|------|
| `.` (core) | `ToolPluginCore`, `ToolResult`, `ToolContext`, `ToolDefinition` | なし |
| `./vue` | `ToolPluginVue`, `ToolPlugin` | Vue |
| `./react` | `ToolPluginReact` | React |

### 使用例

```typescript
// コアロジックのみ（UIなし）
import type { ToolPluginCore, ToolContext, ToolResult } from "gui-chat-protocol";

// Vue アプリケーション
import type { ToolPlugin } from "gui-chat-protocol/vue";

// React アプリケーション
import type { ToolPluginReact } from "gui-chat-protocol/react";
```

---

## プラグイン構造

### ディレクトリ構成

```
GUIChatPluginXxx/
├── package.json              # npm パッケージ設定
├── tsconfig.json             # TypeScript 設定
├── vite.config.ts            # Vite ビルド設定
├── src/
│   ├── index.ts              # メインエントリ（core を再エクスポート）
│   ├── style.css             # Tailwind CSS インポート
│   ├── core/                 # フレームワーク非依存のコア
│   │   ├── index.ts          # Core エクスポート
│   │   ├── types.ts          # プラグイン固有の型定義
│   │   ├── definition.ts     # ツール定義（スキーマ、SYSTEM_PROMPT）
│   │   ├── plugin.ts         # execute 関数と pluginCore
│   │   ├── samples.ts        # テスト用サンプル
│   │   └── logic.ts          # ビジネスロジック（オプション）
│   └── vue/
│       ├── index.ts          # Vue プラグインエクスポート
│       ├── View.vue          # メインビューコンポーネント
│       └── Preview.vue       # プレビューコンポーネント
└── demo/
    ├── App.vue               # デモアプリ
    └── main.ts               # デモエントリポイント
```

### Core と Vue の分離

**Core（フレームワーク非依存）:**

```typescript
// src/core/plugin.ts
import type { ToolPluginCore } from "gui-chat-protocol";

export const pluginCore: ToolPluginCore<XxxToolData, XxxJsonData, XxxArgs> = {
  toolDefinition: TOOL_DEFINITION,
  execute: executeXxx,
  generatingMessage: "Processing...",
  isEnabled: () => true,
  systemPrompt: SYSTEM_PROMPT,
};
```

**Vue（UI アダプター）:**

```typescript
// src/vue/index.ts
import type { ToolPlugin } from "gui-chat-protocol/vue";
import { pluginCore } from "../core/plugin";
import View from "./View.vue";
import Preview from "./Preview.vue";

export const plugin: ToolPlugin<XxxToolData, XxxJsonData, XxxArgs> = {
  ...pluginCore,
  viewComponent: View,
  previewComponent: Preview,
};
```

### パッケージエクスポート

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./core": "./dist/core.js",
    "./vue": "./dist/vue.js",
    "./style.css": "./dist/style.css"
  }
}
```

---

## 型システム

### 主要な型

#### ToolPluginCore

フレームワーク非依存のプラグイン定義。

```typescript
interface ToolPluginCore<T, J, A> {
  toolDefinition: ToolDefinition;    // LLM 用ツール定義
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;          // 処理中に表示するメッセージ
  waitingMessage?: string;            // 結果表示前の LLM へのメッセージ
  isEnabled: (startResponse?) => boolean;  // プラグインが有効か
  systemPrompt?: string;              // LLM への追加指示
  samples?: ToolSample[];             // テスト用サンプル
  backends?: BackendType[];           // 使用するバックエンド
  inputHandlers?: InputHandler[];     // ファイル/クリップボード入力
}
```

#### ToolResult

ツール実行結果。

```typescript
interface ToolResult<T, J> {
  message: string;              // LLM へのステータスメッセージ（必須）
  data?: T;                     // View/Preview 用データ（LLM には送られない）
  jsonData?: J;                 // LLM に返す JSON データ
  title?: string;               // 結果のタイトル
  instructions?: string;        // LLM への追加指示
  instructionsRequired?: boolean; // instructions を必ず送信するか
  updating?: boolean;           // 既存の結果を更新するか
  viewState?: Record<string, unknown>; // View の状態
}
```

#### ToolContext

ツール実行時のコンテキスト。

```typescript
interface ToolContext {
  currentResult?: ToolResult | null;  // 現在選択されている結果
  app?: ToolContextApp;               // アプリが提供する機能
}
```

### 型パラメータの説明

```typescript
ToolPlugin<T, J, A>
```

| パラメータ | 説明 | 用途 |
|-----------|------|------|
| `T` | `result.data` の型 | UI 表示用データ（LLM には送られない） |
| `J` | `result.jsonData` の型 | LLM に返すデータ |
| `A` | `execute` 関数の引数の型 | ツールのパラメータ |

### 型の使い分け

| データ | 格納先 | 送信先 | 例 |
|--------|--------|--------|-----|
| UI 表示用の大きなデータ | `result.data` | View/Preview のみ | 画像データ、HTML |
| LLM が判断に使うデータ | `result.jsonData` | LLM | ゲーム状態、合法手 |
| 簡潔なステータス | `result.message` | LLM | "Image generated" |

---

## バックエンド抽象化

### 設計思想

プラグインは具体的な AI プロバイダを知らず、「バックエンド種別」のみを宣言します。

```typescript
// Before: プラグインがプロバイダ選択 UI を持つ（問題あり）
config: {
  component: HtmlGenerationConfig,  // Claude or Gemini 選択
}

// After: プラグインは種別だけを宣言（推奨）
backends: ["textLLM"],
```

### バックエンド種別

```typescript
type BackendType =
  | "textLLM"    // テキスト生成 LLM（Claude, Gemini）
  | "imageGen"   // 画像生成（DALL-E, Imagen）
  | "audio"      // 音声処理
  | "search"     // 検索（Exa）
  | "browse"     // Web ブラウジング
  | "map"        // 地図（Google Maps）
  | "mulmocast"; // Mulmocast
```

### レイヤー構造

```
┌─────────────────────────────────────────┐
│  プラグイン                              │
│  backends: ["textLLM"]                   │ ← 種別のみ宣言
├─────────────────────────────────────────┤
│  アプリ層（設定管理）                     │
│  textLLM: { provider: "anthropic" }     │ ← 具体的なプロバイダ
├─────────────────────────────────────────┤
│  バックエンドサービス                     │
│  Anthropic API / Google API             │ ← 実際の API 呼び出し
└─────────────────────────────────────────┘
```

### context.app が提供する機能

| 機能 | 説明 | 使用するバックエンド |
|------|------|---------------------|
| `generateImage(prompt)` | 画像生成 | `imageGen` |
| `generateHtml({ prompt })` | HTML 生成 | `textLLM` |
| `browseUrl(url)` | Web ページ取得 | `browse` |
| `searchExa(args)` | Exa 検索 | `search` |
| `getConfig(key)` | 設定値取得 | - |
| `setConfig(key, value)` | 設定値保存 | - |

---

## 外部入力ハンドラー

### 概要

プラグインがファイルアップロードやクリップボードからの入力を受け付けるための仕組み。

### InputHandler の種類

```typescript
type InputHandler =
  | FileInputHandler        // ファイルアップロード
  | ClipboardImageInputHandler  // クリップボード画像
  | UrlInputHandler         // URL 入力
  | TextInputHandler        // テキスト入力
  | CameraInputHandler      // カメラキャプチャ
  | AudioInputHandler;      // 音声入力
```

### 使用例

```typescript
export const pluginCore: ToolPluginCore = {
  // ...
  inputHandlers: [
    {
      type: "file",
      acceptedTypes: ["image/png", "image/jpeg"],
      handleInput: (data, fileName) => ({
        toolName: TOOL_NAME,
        data: { imageData: data },
        message: "",
        title: fileName,
      }),
    },
    {
      type: "clipboard-image",
      handleInput: (data) => ({
        toolName: TOOL_NAME,
        data: { imageData: data },
        message: "Image pasted from clipboard",
      }),
    },
  ],
};
```

---

## 将来の拡張

### リソース参照システム

ツール結果を他のツールから参照可能にする。

```typescript
interface ToolContext {
  // 既存
  currentResult?: ToolResult | null;
  app?: ToolContextApp;

  // 将来追加
  results?: {
    getById: (uuid: string) => ToolResultComplete | null;
    getByType: (resourceType: string) => ToolResultComplete[];
  };
}
```

**期待される効果:**
- 「さっき作った画像を使って」が可能に
- ツール間のデータ共有が明示的に

### ツール機能宣言（Capabilities）

ツールが何をできるかを宣言。

```typescript
interface ToolCapabilities {
  outputType?: "image" | "document" | "chart" | "audio" | "data";
  acceptsInputTypes?: string[];
  streaming?: boolean;
  undoable?: boolean;
}
```

**期待される効果:**
- LLM がツール選択時に適切な判断可能
- ホストアプリが UI を動的に調整

### ストリーミング実行

長時間処理の進捗をリアルタイムで表示。

```typescript
interface ToolPluginCore {
  execute: (context, args) => Promise<ToolResult>;

  // 将来追加
  executeStream?: (
    context,
    args,
    onProgress: (update: StreamUpdate) => void
  ) => Promise<ToolResult>;
}
```

---

## 参考資料

### 関連ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [plugin-development-guide.ja.md](./plugin-development-guide.ja.md) | プラグイン開発の詳細手順 |
| [plugin-extraction-guide.ja.md](./plugin-extraction-guide.ja.md) | 既存プラグインの独立化手順 |

### 既存プラグイン一覧

| パッケージ名 | 特徴 |
|------------|------|
| `@gui-chat-plugin/quiz` | jsonData 使用、シンプルなデータ表示 |
| `@gui-chat-plugin/generate-image` | inputHandlers, backends, 共有 UI |
| `@gui-chat-plugin/othello` | ゲーム、インタラクティブ UI、sendTextMessage |
| `@gui-chat-plugin/generate-html` | context.app, isEnabled, backends |
| `@gui-chat-plugin/scroll-to-anchor` | updating, viewState, currentResult |
| `@gui-chat-plugin/switch-role` | context 拡張、カスタム関数 |
| `@gui-chat-plugin/spreadsheet` | 複雑なロジック、logic.ts 分離 |

### 外部リソース

- [gui-chat-protocol npm パッケージ](https://www.npmjs.com/package/gui-chat-protocol)
- [Vue 3 コンポーネント](https://vuejs.org/guide/components/registration.html)
- [Vite ライブラリモード](https://vitejs.dev/guide/build.html#library-mode)
