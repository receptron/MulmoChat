# GUIChat プラグイン開発ガイド

このドキュメントでは、GUIChat/MulmoChat のプラグインを新規開発するための完全なガイドを提供します。人間でも AI でもワンショットで実装できることを目指しています。

## このガイドの範囲

### このガイドが提供するもの

- **プラグイン構造**: ディレクトリ構成、ファイル命名規則、エクスポートパターン
- **型定義パターン**: ToolPluginCore、ToolResult、ToolContext の使い方
- **Vue コンポーネント**: View/Preview コンポーネントの props と基本構造
- **ビルド設定**: package.json、vite.config.ts、tsconfig.json の設定方法
- **統合パターン**: context API、backends、isEnabled の使い方

### 開発者が用意するもの

- **機能仕様**: プラグインが何をするか（パラメータ、動作、出力）
- **ドメインロジック**: ゲームルール、計算アルゴリズム、データ変換など
- **UI 要件**: 表示するコンテンツ、インタラクション、デザイン

このガイドは「プラグインの作り方」を教えますが、「何を作るか」は要件定義から得る必要があります。

## 目次

1. [gui-chat-protocol とは](#gui-chat-protocol-とは)
2. [プラグインアーキテクチャ](#プラグインアーキテクチャ)
3. [ディレクトリ構造](#ディレクトリ構造)
4. [開発手順](#開発手順)
5. [samples を使ったテスト](#samples-を使ったテスト)
6. [実装例: オセロプラグイン](#実装例-オセロプラグイン)
7. [context API の使い方](#context-api-の使い方)
8. [参考プラグイン一覧](#参考プラグイン一覧)
9. [完了チェックリスト](#完了チェックリスト)
10. [AI への指示テンプレート](#ai-への指示テンプレート)

---

## gui-chat-protocol とは

### 概要

`gui-chat-protocol` は、GUIChat プラグインの標準プロトコルを定義する TypeScript ライブラリです。フレームワーク非依存のコア型と、Vue/React アダプターを提供します。

```bash
npm install gui-chat-protocol
```

### パッケージエクスポート

```typescript
// Core 型（フレームワーク非依存）
import { ToolPluginCore, ToolResult, ToolContext, ToolDefinition } from "gui-chat-protocol";

// Vue 用型
import { ToolPlugin } from "gui-chat-protocol/vue";

// React 用型
import { ToolPluginReact } from "gui-chat-protocol/react";
```

### 主要な型

| 型 | 説明 |
|----|------|
| `ToolPluginCore<T, J, A>` | フレームワーク非依存のプラグイン定義 |
| `ToolPlugin<T, J, A>` | Vue 用プラグイン（viewComponent, previewComponent を含む） |
| `ToolResult<T, J>` | execute 関数の戻り値 |
| `ToolContext` | execute 関数に渡されるコンテキスト |
| `ToolDefinition` | OpenAI 互換のツール定義スキーマ |
| `ToolSample` | テスト用サンプル引数 |

### ToolPluginCore の構造

```typescript
interface ToolPluginCore<T, J, A, H, S> {
  toolDefinition: ToolDefinition;    // LLM 用ツール定義
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;          // 処理中に表示するメッセージ
  waitingMessage?: string;            // 結果表示前に LLM に伝えるメッセージ
  isEnabled: (startResponse?: S) => boolean;  // プラグインが有効か
  systemPrompt?: string;              // LLM への追加指示
  samples?: ToolSample[];             // テスト用サンプル
  backends?: BackendType[];           // 使用するバックエンド
  inputHandlers?: InputHandler[];     // ファイル/クリップボードの入力ハンドラー
}
```

### backends の種類

| Backend | 説明 | 使用例 |
|---------|------|--------|
| `"imageGen"` | 画像生成 API | GenerateImage, EditImage |
| `"textLLM"` | テキスト生成 LLM | GenerateHtml, EditHtml |

```typescript
// 例: 画像生成プラグイン
backends: ["imageGen"],

// 例: HTML 生成プラグイン
backends: ["textLLM"],
```

### inputHandlers（ファイル入力ハンドラー）

プラグインがファイルアップロードやクリップボードからの入力を受け付ける場合に使用します。

```typescript
interface InputHandler {
  type: "file" | "clipboard-image";
  acceptedTypes?: string[];  // MIME タイプ（file の場合）
  handleInput: (data: string, fileName?: string) => ToolResult<T>;
}
```

**使用例（画像プラグイン）:**

```typescript
// src/core/plugin.ts
import type { ToolResult } from "gui-chat-protocol";
import type { ImageToolData } from "./types";

// ヘルパー関数: アップロードされた画像から ToolResult を作成
export function createUploadedImageResult(
  imageData: string,
  fileName: string,
  prompt: string,
): ToolResult<ImageToolData, never> {
  return {
    toolName: TOOL_NAME,
    data: { imageData, prompt },
    message: "",
    title: fileName,
  };
}

export const pluginCore = {
  // ...他のプロパティ
  inputHandlers: [
    {
      type: "file",
      acceptedTypes: ["image/png", "image/jpeg"],
      handleInput: (data: string, fileName?: string) =>
        createUploadedImageResult(data, fileName || "image.png", ""),
    },
    {
      type: "clipboard-image",
      handleInput: (data: string) =>
        createUploadedImageResult(data, "clipboard-image.png", ""),
    },
  ],
};
```

### ToolResult の構造

```typescript
interface ToolResult<T, J> {
  message: string;              // LLM へのステータスメッセージ（必須）
  data?: T;                     // View/Preview 用データ（LLM には送られない）
  jsonData?: J;                 // LLM に返す JSON データ
  title?: string;               // 結果のタイトル
  instructions?: string;        // LLM への追加指示
  instructionsRequired?: boolean; // instructions を必ず送信するか
  updating?: boolean;           // 既存の結果を更新するか（true = 新規作成しない）
  viewState?: Record<string, unknown>; // View の状態
}
```

### 型パラメータの説明

```typescript
ToolPlugin<T, J, A>
```

| パラメータ | 説明 | 例 |
|-----------|------|-----|
| `T` | `result.data` の型（UI 用、LLM には送られない） | `OthelloState` |
| `J` | `result.jsonData` の型（LLM に送られる） | `{ success: boolean }` |
| `A` | execute 関数の引数の型 | `{ action: string; row?: number }` |

---

## プラグインアーキテクチャ

### 動作フロー

```
ユーザー入力 → LLM → ツール呼び出し → execute() → ToolResult → View/Preview
     ↑                                                              │
     └──────────────── instructions で LLM に指示 ←──────────────────┘
```

### execute() をサーバーで実行する

ホストは、プラグインの `execute()` をブラウザではなくサーバーで実行することがあります。MulmoTerminal はすべてのプラグインをこの方式で実行しています。MulmoChat では `generateImage` がこの方式です。ブラウザは呼び出しを `POST /api/plugin/<toolName>` に転送し、サーバーが自身の `context.app` を渡して `execute()` を実行します。この方式で動かすには、次の条件を満たしてください。

- **フレームワークに依存しない core エントリーを用意する。** パッケージのメインエントリー（または `./core`）で `TOOL_DEFINITION` と、`execute` を持つ `pluginCore` を export し、Vue を import しないでください。サーバーはこのエントリーを直接 import します。
- **バックエンドには `context` 経由でのみアクセスする。** `execute()` の中では、ホストのルートを `fetch` したり、ブラウザの API（`window`、`localStorage`）に触れたりせず、`context.app.generateImage(prompt)` のようなホストのバックエンドを呼び出してください。サーバー上では、`context.app` にサーバー側の実装が入ります。ファイルを保存するときは `context.files.artifacts` を使ってください（ホストの artifacts フォルダーからの相対パスで読み書きします）。フォルダーの外を指すパスは拒否されます。
- **JSON にシリアライズできる結果を返す。** `ToolResult` は HTTP でブラウザに返されるため、`data` と `jsonData` は `JSON.stringify` で失われない値にしてください。画像は `Blob` ではなく、データ URL か URL で返してください。
- **`definePlugin` のファクトリー形式のパッケージは、MulmoChat のサーバー側レジストリではまだサポートしていません。** 通常の `pluginCore` 形式を使ってください。

View と Preview は変わりません。返された `ToolResult` をもとに、引き続きブラウザで表示されます。

### View でのプラグインランタイムと言語

MulmoChat は、すべてのプラグインの View と Preview に gui-chat-protocol の `BrowserPluginRuntime` を渡しています。コンポーネントの中で `gui-chat-protocol/vue` の `useRuntime()` を呼び出せます。

- **`locale`** はユーザーの言語設定で、リアクティブな ref です（`en`、`ja`、`zh`、`pt-BR` など。MulmoChat の `pt` は `pt-BR` として渡されます）。プラグインの文言を翻訳するには `createUseT({ en, ja, … })` を使うのが簡単です。この locale を読み取り、訳がない言語では `en` にフォールバックします。
- **`dispatch(args)`** は `{ args, config }` を `POST /api/plugin/<toolName>` に送ります。そのため、サーバーで動くプラグインにしか届きません。`config` にはユーザーの設定が入っているため、`context.app.generateImage` などのバックエンドはユーザーが選んだモデルを使います。サーバーはプラグインの `execute(context, args)` を呼び出します。そのため、View からの操作は、`execute` が振り分けに使う `kind` フィールドを持つ `args` オブジェクトにするのが一般的です（`@mulmoclaude/markdown-plugin` を参照）。
- **`openUrl(url)`** は http(s) の URL を新しいタブで開きます。それ以外のスキームは無視します。
- **`log`** はツール名を付けてブラウザのコンソールに出力します。
- **`pubsub.subscribe`** は、プラグインのリクエストが書き込んだワークスペースのファイル（`context.files.artifacts` 経由など）について、`file:<path>` イベントを `{ mtimeMs }` 付きで届けます。ファイルを表示する View はこれを購読すると、保存後に再読み込みできます。`@mulmoclaude/core/plugin-vue` の `useFileWatch` がこれを行います。MulmoChat がこれ以外のイベントを発行することはありません。

### View と Preview の違い

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

## ディレクトリ構造

```
GUIChatPluginXxx/
├── package.json              # npm パッケージ設定
├── tsconfig.json             # TypeScript 設定
├── tsconfig.build.json       # ビルド用 TypeScript 設定
├── vite.config.ts            # Vite ビルド設定
├── eslint.config.js          # ESLint 設定
├── index.html                # デモ用 HTML
├── README.md                 # npm 公開用 README
├── .gitignore
├── .github/
│   └── workflows/
│       └── pull_request.yaml # CI 設定
├── src/
│   ├── index.ts              # メインエントリ（core を再エクスポート）
│   ├── style.css             # Tailwind CSS インポート
│   ├── core/                 # フレームワーク非依存のコア
│   │   ├── index.ts          # Core エクスポート
│   │   ├── types.ts          # プラグイン固有の型定義
│   │   ├── definition.ts     # ツール定義（TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT）
│   │   ├── plugin.ts         # execute 関数と pluginCore
│   │   ├── samples.ts        # テスト用サンプル（オプション）
│   │   └── logic.ts          # ビジネスロジック（オプション）
│   └── vue/
│       ├── index.ts          # Vue プラグインエクスポート
│       ├── View.vue          # メインビューコンポーネント
│       └── Preview.vue       # プレビューコンポーネント
└── demo/
    ├── App.vue               # デモアプリ（samples を使ったテスト）
    └── main.ts               # デモエントリポイント
```

---

## Tailwind CSS ガイドライン

### 重要: Arbitrary Values（任意値）は使用禁止

**プラグインコードでは Tailwind の arbitrary values（JIT 構文）を使用しないでください。**

MulmoChat は Tailwind の `@source` ディレクティブを使用してプラグインの dist ファイルをスキャンします。そのため、標準の Tailwind クラスのみがサポートされ、`bg-[#1a1a2e]` や `w-[137px]` のような arbitrary values はビルド時スキャンが必要なため動作しません。

```html
<!-- ✅ 良い例: 標準 Tailwind クラス -->
<div class="bg-slate-900 w-48 p-4">

<!-- ❌ 悪い例: Arbitrary values - 動作しません -->
<div class="bg-[#1a1a2e] w-[137px] p-[10px]">
```

### なぜ重要か

```
プラグインを個別にビルド → dist/vue.js
                              ↓
MulmoChat の @source がスキャン → "bg-slate-900" を検出 → CSS 生成 ✓
                              ↓
                        → "bg-[#1a1a2e]" を検出 → CSS 生成されない ✗
```

Tailwind は arbitrary values に対応する CSS を生成するためにビルド時にそれらを検出する必要があります。プラグインは個別にビルドされ、MulmoChat の `@source` ディレクティブでスキャンされるため、スキャン対象ファイル内の arbitrary values は CSS 生成をトリガーしません。

### 代替手段

カスタムカラーやサイズが必要な場合:

1. **最も近い標準 Tailwind 値を使用**
   - `bg-[#1a1a2e]` の代わりに `bg-slate-900` や `bg-gray-900` を使用

2. **プラグインの style.css でカスタムスタイルを定義**
   ```css
   /* src/style.css */
   @import "tailwindcss";

   .my-custom-bg {
     background-color: #1a1a2e;
   }
   ```

3. **動的な値にはインラインスタイルを使用**
   ```vue
   <div :style="{ backgroundColor: dynamicColor }">
   ```

---

## 開発手順

### Step 1: テンプレートからプロジェクト作成

```bash
# ディレクトリ作成
mkdir -p ../GUIChatPluginXxx/src/{core,vue} ../GUIChatPluginXxx/demo ../GUIChatPluginXxx/.github/workflows
cd ../GUIChatPluginXxx

# テンプレートからファイルをコピー（MulmoChatPluginQuiz を推奨）
TEMPLATE="../MulmoChatPluginQuiz"

cp $TEMPLATE/tsconfig.json .
cp $TEMPLATE/tsconfig.build.json .
cp $TEMPLATE/eslint.config.js .
cp $TEMPLATE/.gitignore .
cp $TEMPLATE/index.html .
cp $TEMPLATE/.github/workflows/pull_request.yaml .github/workflows/
cp $TEMPLATE/src/style.css src/
cp $TEMPLATE/package.json .
cp $TEMPLATE/vite.config.ts .
cp $TEMPLATE/README.md .
```

### Step 2: 設定ファイルを編集

**package.json:**
```json
{
  "name": "@gui-chat-plugin/xxx",
  "description": "プラグインの説明",
  "keywords": ["guichat", "plugin", "xxx"]
}
```

**vite.config.ts:**
```typescript
name: "GUIChatPluginXxx",
```

### Step 3: Core ファイルを作成

#### src/core/types.ts
```typescript
/** UI 用データ型（View/Preview で使用） */
export interface XxxToolData {
  content: string;
}

/** execute 関数の引数型 */
export interface XxxArgs {
  prompt: string;
}

/** LLM に返すデータ型（オプション） */
export interface XxxJsonData {
  success: boolean;
}
```

#### src/core/definition.ts
```typescript
import type { ToolDefinition } from "gui-chat-protocol";

export const TOOL_NAME = "xxxTool";

export const TOOL_DEFINITION: ToolDefinition = {
  type: "function",
  name: TOOL_NAME,
  description: "ツールの説明。LLM がいつこのツールを使うべきかを明確に",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "パラメータの説明",
      },
    },
    required: ["prompt"],
  },
};

export const SYSTEM_PROMPT = `${TOOL_NAME} の使用に関する追加指示...`;
```

#### src/core/samples.ts
```typescript
import type { ToolSample } from "gui-chat-protocol";

export const samples: ToolSample[] = [
  {
    name: "Sample 1",
    args: { prompt: "test prompt" },
  },
];
```

#### src/core/plugin.ts
```typescript
import type { ToolPluginCore, ToolContext, ToolResult } from "gui-chat-protocol";
import type { XxxToolData, XxxArgs, XxxJsonData } from "./types";
import { TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";

export { TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";

export const executeXxx = async (
  _context: ToolContext,
  args: XxxArgs,
): Promise<ToolResult<XxxToolData, XxxJsonData>> => {
  return {
    data: { content: args.prompt },
    message: "Success",
    jsonData: { success: true },
    instructions: "Tell the user the operation completed.",
  };
};

export const pluginCore: ToolPluginCore<XxxToolData, XxxJsonData, XxxArgs> = {
  toolDefinition: TOOL_DEFINITION,
  execute: executeXxx,
  generatingMessage: "Processing...",
  isEnabled: () => true,
  systemPrompt: SYSTEM_PROMPT,
};
```

#### src/core/index.ts
```typescript
export type { XxxToolData, XxxArgs, XxxJsonData } from "./types";
export { TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT, executeXxx, pluginCore } from "./plugin";
export { samples } from "./samples";
```

### Step 4: Vue ファイルを作成

#### src/vue/View.vue
```vue
<template>
  <div class="w-full h-full p-4">
    <div v-if="selectedResult.data">
      {{ selectedResult.data.content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { XxxToolData } from "../core/types";

defineProps<{
  selectedResult: ToolResult<XxxToolData>;
  sendTextMessage?: (text?: string) => void;
}>();
</script>
```

#### src/vue/Preview.vue
```vue
<template>
  <div class="p-4 bg-blue-50 rounded text-center">
    <div class="text-blue-600 font-medium">🔧 Xxx</div>
    <div class="text-sm text-gray-800 truncate">{{ result.title || "Untitled" }}</div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { XxxToolData } from "../core/types";

defineProps<{
  result: ToolResult<XxxToolData>;
}>();
</script>
```

#### src/vue/index.ts
```typescript
import "../style.css";
import type { ToolPlugin } from "gui-chat-protocol/vue";
import type { XxxToolData, XxxArgs, XxxJsonData } from "../core/types";
import { pluginCore } from "../core/plugin";
import { samples } from "../core/samples";
import View from "./View.vue";
import Preview from "./Preview.vue";

export const plugin: ToolPlugin<XxxToolData, XxxJsonData, XxxArgs> = {
  ...pluginCore,
  viewComponent: View,
  previewComponent: Preview,
  samples,
};

export type { XxxToolData, XxxArgs, XxxJsonData } from "../core/types";
export { TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT, executeXxx, pluginCore } from "../core/plugin";
export { samples } from "../core/samples";
export { View, Preview };

export default { plugin };
```

#### src/index.ts
```typescript
export * from "./core";
```

### Step 5: ビルドと検証

```bash
yarn install
yarn typecheck
yarn lint
yarn build
```

---

## samples を使ったテスト

### samples とは

`samples` は、プラグインをスタンドアロンでテストするためのサンプル引数です。デモアプリで execute 関数を直接呼び出してテストできます。

```typescript
// src/core/samples.ts
export const samples: ToolSample[] = [
  {
    name: "New Game (User First)",  // ボタンに表示される名前
    args: {                          // execute に渡される引数
      action: "new_game",
      firstPlayer: "user",
    },
  },
];
```

### デモアプリの実装

```vue
<!-- demo/App.vue -->
<template>
  <div class="max-w-3xl mx-auto p-8">
    <h1 class="text-2xl font-bold mb-8">{{ pluginName }} Demo</h1>

    <!-- サンプルボタン -->
    <div class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-xl mb-4">Samples</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(sample, index) in samplesList"
          :key="index"
          @click="executeSample(sample)"
          class="py-2 px-4 bg-indigo-100 rounded hover:bg-indigo-200"
        >
          {{ sample.name }}
        </button>
      </div>
    </div>

    <!-- View コンポーネント -->
    <div v-if="ViewComponent" class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-xl mb-4">View Component</h2>
      <component
        :is="ViewComponent"
        :selectedResult="result"
        :sendTextMessage="handleSendMessage"
      />
    </div>

    <!-- Preview コンポーネント -->
    <div v-if="PreviewComponent" class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-xl mb-4">Preview Component</h2>
      <div class="max-w-[200px]">
        <component :is="PreviewComponent" :result="result" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { plugin, executeXxx } from "../src/vue";
import type { ToolResult, ToolSample, ToolPlugin } from "gui-chat-protocol/vue";
import type { XxxToolData, XxxArgs } from "../src/core/types";

const currentPlugin = plugin as unknown as ToolPlugin;
const pluginName = computed(() => currentPlugin.toolDefinition.name);
const samplesList = computed(() => currentPlugin.samples || []);
const ViewComponent = computed(() => currentPlugin.viewComponent);
const PreviewComponent = computed(() => currentPlugin.previewComponent);

const result = ref<ToolResult<XxxToolData>>({
  toolName: pluginName.value,
  uuid: "demo-uuid",
  message: "Ready",
});

const executeSample = async (sample: ToolSample) => {
  const args = sample.args as unknown as XxxArgs;
  const execResult = await executeXxx({} as any, args);
  result.value = { ...result.value, ...execResult, uuid: `demo-${Date.now()}` };
};

const handleSendMessage = (text?: string) => {
  console.log("sendTextMessage:", text);
};
</script>
```

### テスト実行

```bash
yarn dev  # http://localhost:5173 でデモが起動
```

---

## 実装例: オセロプラグイン

オセロプラグインは、インタラクティブなゲームを実装する良い例です。

**参照:** [GUIChatPluginOthello](https://github.com/nicedoc/GUIChatPluginOthello)

### 型定義 (types.ts)

```typescript
export type Side = "B" | "W";
export type Cell = "." | "B" | "W";
export type Board = Cell[][];

export interface OthelloState {
  board: Board;
  currentSide: Side;
  playerNames: Record<Side, string>;
  legalMoves: { row: number; col: number }[];
  isTerminal: boolean;
  winner?: Side | "draw";
  error?: string;
}

export interface OthelloArgs {
  action: "new_game" | "move" | "pass";
  firstPlayer?: string;
  row?: number;
  col?: number;
  board?: Board;
  currentSide?: string;
  playerNames?: Record<string, string>;
}
```

### execute 関数 (plugin.ts)

```typescript
export const executeOthello = async (
  _context: ToolContext,
  args: OthelloArgs,
): Promise<ToolResult<never, OthelloState>> => {
  const state = playOthello(args);  // ゲームロジック

  const isComputerTurn = state.playerNames[state.currentSide] === "computer";

  const instructions = state.isTerminal
    ? "The game is over. Announce the result."
    : isComputerTurn
      ? "It is your turn. Choose your next move."
      : "Tell the user to make a move.";

  return {
    message: `Played at (${args.row}, ${args.col})`,
    jsonData: state,  // LLM に盤面状態を返す
    instructions,
    instructionsRequired: isComputerTurn,  // コンピュータのターンは必ず指示を送る
    updating: args.action !== "new_game",  // new_game 以外は既存の結果を更新
  };
};
```

### View コンポーネントのポイント

```vue
<script setup>
// sendTextMessage でユーザーの操作を LLM に伝える
const handleCellClick = (row, col) => {
  const clickData = { row, col, currentState: gameState.value };
  props.sendTextMessage(
    `I want to play at ${columnLetter}${rowNumber}`,
    { data: clickData }  // オプションでデータを渡せる
  );
};
</script>
```

### samples (samples.ts)

```typescript
export const samples: ToolSample[] = [
  { name: "New Game (User First)", args: { action: "new_game", firstPlayer: "user" } },
  { name: "New Game (Computer First)", args: { action: "new_game", firstPlayer: "computer" } },
];
```

---

## context API の使い方

### context の構造

execute 関数には `ToolContext` が渡されます。これを通じてアプリの機能にアクセスできます。

```typescript
interface ToolContext {
  currentResult?: ToolResult | null;  // 現在選択されている結果（updating 時に使用）
  app?: ToolContextApp;               // アプリが提供する機能
}
```

### context.app が提供する機能一覧

MulmoChat の `context.app` は以下の機能を提供します：

| 機能 | 説明 | 戻り値 | 使用例プラグイン |
|------|------|--------|-----------------|
| `getConfig(key)` | 設定値を取得 | `T \| undefined` | SetImageStyle |
| `setConfig(key, value)` | 設定値を保存 ※許可されたプラグインのみ | `void` | SetImageStyle |
| `generateImage(prompt)` | 画像生成 | `Promise<string>` | GenerateImage |
| `editImage(prompt)` | 画像編集 | `Promise<string>` | EditImage |
| `generateHtml({ prompt })` | LLM で HTML 生成 | `Promise<{ success, html?, error? }>` | GenerateHtml, EditHtml |
| `browseUrl(url)` | Web ページ取得 | `Promise<BrowseResult>` | Browse |
| `getTwitterEmbed(url)` | Twitter 埋め込み取得 | `Promise<string>` | Browse |
| `searchExa(args)` | Exa 検索 | `Promise<SearchResult>` | Exa |
| `summarizePdf(params)` | PDF 要約 | `Promise<string>` | SummarizePdf |
| `saveImages({ uuid, images })` | 画像保存 | `Promise<SaveResult>` | Canvas, Markdown |
| `getImageConfig()` | 画像生成設定を取得 | `ImageGenerationConfig` | SetImageStyle |
| `getRoles()` | ロール一覧を取得 | `Role[]` | SwitchRole |
| `switchRole(roleId)` | ロールを切り替え | `void` | SwitchRole |

### 具体的な実装例

#### 例1: バックエンドを呼び出す（GenerateHtml）

```typescript
// GUIChatPluginGenerateHtml/src/core/plugin.ts
export const executeGenerateHtml = async (
  context: ToolContext,
  args: GenerateHtmlArgs,
): Promise<ToolResult<HtmlToolData>> => {
  const { prompt } = args;

  // 1. 機能の存在チェック（必須）
  if (!context.app?.generateHtml) {
    return {
      message: "generateHtml function not available",
      instructions: "Acknowledge that the HTML generation failed.",
    };
  }

  try {
    // 2. バックエンドを呼び出し
    const data = await context.app.generateHtml({ prompt });

    // 3. 結果に応じて返却
    if (data.success && data.html) {
      return {
        data: { html: data.html, type: "tailwind" },
        title: prompt.slice(0, 50),
        message: "HTML generation succeeded",
        instructions: "Acknowledge that the HTML was generated.",
      };
    } else {
      return {
        message: data.error || "HTML generation failed",
        instructions: "Acknowledge that the HTML generation failed.",
      };
    }
  } catch (error) {
    return {
      message: "HTML generation failed",
      instructions: "Acknowledge that the HTML generation failed.",
    };
  }
};

// pluginCore で isEnabled と backends を設定
export const pluginCore = {
  // ...
  isEnabled: (startResponse) =>
    !!startResponse?.hasAnthropicApiKey || !!startResponse?.hasGoogleApiKey,
  backends: ["textLLM"],  // 使用するバックエンドを明示
};
```

#### 例2: Web ページを取得する（Browse）

```typescript
// GUIChatPluginBrowse/src/core/plugin.ts
export const browse = async (
  context: ToolContext,
  args: BrowseArgs,
): Promise<BrowseResult> => {
  const { url } = args;

  // Twitter URL の場合は埋め込みを取得
  if (isTwitterUrl(url)) {
    const embedHtml = await context.app?.getTwitterEmbed?.(url);
    // embedHtml を保存...
  }

  if (!context.app?.browseUrl) {
    return {
      message: "browseUrl function not available",
      instructions: "Acknowledge that the webpage browsing failed.",
    };
  }

  try {
    const data = await context.app.browseUrl(url);

    if (data.success && data.data) {
      return {
        message: "Successfully browsed the webpage",
        title: data.data.title || "Untitled",
        jsonData: { data: data.data },  // LLM にページ内容を返す
        data: { url, twitterEmbedHtml },  // UI 用データ
        instructions: "Give a ONE-SENTENCE summary of the content.",
      };
    }
  } catch (error) {
    // エラー処理
  }
};
```

#### 例3: 設定を読み書きする（SetImageStyle）

```typescript
// GUIChatPluginSetImageStyle/src/core/plugin.ts
export const executeSetImageStyle = async (
  context: ToolContext,
  args: SetImageStyleArgs,
): Promise<ToolResult<SetImageStyleData, SetImageStyleJsonData>> => {
  const { styleModifier } = args;

  // context.app を拡張した型でキャスト
  const app = context.app as {
    getImageConfig?: () => ImageGenerationConfig;
    setConfig?: (key: string, value: ImageGenerationConfig) => void;
  };

  if (!app?.getImageConfig) {
    return {
      message: "getImageConfig function not available",
      jsonData: { success: false, error: "getImageConfig not available" },
    };
  }

  try {
    // 現在の設定を取得
    const config = app.getImageConfig();
    const previousStyleModifier = config.styleModifier || "";

    // 新しい設定を作成
    const newConfig: ImageGenerationConfig = {
      ...config,
      styleModifier: styleModifier.trim(),
    };

    // setConfig で設定を保存（許可されたプラグインのみ使用可能）
    app.setConfig?.("imageGenerationBackend", newConfig);

    return {
      message: `Image style set to: ${styleModifier.trim()}`,
      data: { styleModifier: styleModifier.trim(), previousStyleModifier },
      jsonData: { success: true, styleModifier: styleModifier.trim() },
      instructions: `Acknowledge that all future images will use the style: "${styleModifier.trim()}"`,
      instructionsRequired: true,
    };
  } catch (error) {
    // エラー処理
  }
};
```

**注意:** `setConfig` は MulmoChat で許可されたプラグインのみ使用可能です（セキュリティ対策）。

#### 例4: 既存の結果を更新する（ScrollToAnchor）

```typescript
// GUIChatPluginScrollToAnchor/src/core/plugin.ts
export const executeScrollToAnchor = async (
  context: ToolContext,
  args: ScrollToAnchorArgs,
): Promise<ToolResult> => {
  const { anchorId } = args;

  // currentResult の存在チェック
  if (!context.currentResult) {
    return {
      message: "No document is currently displayed to scroll.",
      updating: false,
    };
  }

  // 既存の結果をコピーして viewState を更新
  return {
    ...context.currentResult,
    message: `Scrolled to ${anchorId}`,
    updating: true,  // 重要: 新規作成せず既存の結果を更新
    viewState: {
      ...context.currentResult.viewState,
      scrollToAnchor: anchorId,
      scrollTimestamp: Date.now(),  // 同じアンカーでも反応するようにタイムスタンプ追加
    },
    instructions: "Read the step aloud.",
    instructionsRequired: true,
  };
};
```

#### 例5: アプリ固有機能を使う（SwitchRole）

```typescript
// GUIChatPluginSwitchRole/src/core/plugin.ts

// context を拡張して必要な機能を型定義
interface SwitchRoleToolContext extends ToolContext {
  app?: ToolContext["app"] & {
    getRoles?: () => Role[];
    switchRole?: (roleId: string) => void;
  };
}

export const executeSwitchRole = async (
  context: SwitchRoleToolContext,
  args: SwitchRoleArgs,
): Promise<ToolResult<unknown, SwitchRoleJsonData>> => {
  const { role } = args;

  // getRoles が利用可能かチェック
  if (typeof context.app?.getRoles !== "function") {
    console.warn("switchRole: context.app.getRoles() not available");
    return {
      message: "getRoles function not available",
      jsonData: { success: false, error: "getRoles not available" },
    };
  }

  const roles = context.app.getRoles();
  const validRole = roles.find((r) => r.id === role);

  if (!validRole) {
    const availableRoles = roles.map((r) => `${r.id} (${r.name})`).join(", ");
    return {
      message: `Invalid role: ${role}`,
      jsonData: { success: false, availableRoles: roles },
      instructions: `Tell the user that '${role}' is not valid. Available: ${availableRoles}`,
    };
  }

  // switchRole を非同期で呼び出し（接続切断を伴うため setTimeout を使用）
  if (typeof context.app?.switchRole === "function") {
    setTimeout(() => {
      context.app?.switchRole?.(role);
    }, 0);
  }

  return {
    message: `Role switch to '${validRole.name}' initiated`,
    jsonData: { success: true, role, roleName: validRole.name },
  };
};
```

### パターン別実装

#### パターン A: バックエンドを呼び出す

**参照:** [GUIChatPluginGenerateHtml](https://github.com/nicedoc/GUIChatPluginGenerateHtml)

```typescript
export const executeGenerateHtml = async (
  context: ToolContext,
  args: GenerateHtmlArgs,
): Promise<ToolResult<HtmlToolData>> => {
  if (!context.app?.generateHtml) {
    return { message: "generateHtml not available" };
  }

  const data = await context.app.generateHtml({ prompt: args.prompt });
  return {
    data: { html: data.html },
    message: "HTML generated",
  };
};

// isEnabled でバックエンドの有無をチェック
export const pluginCore = {
  isEnabled: (startResponse) =>
    !!startResponse?.hasAnthropicApiKey || !!startResponse?.hasGoogleApiKey,
  backends: ["textLLM"],
};
```

#### パターン B: 既存の結果を更新する

**参照:** [GUIChatPluginScrollToAnchor](https://github.com/nicedoc/GUIChatPluginScrollToAnchor)

```typescript
export const executeScrollToAnchor = async (
  context: ToolContext,
  args: ScrollToAnchorArgs,
): Promise<ToolResult> => {
  if (!context.currentResult) {
    return { message: "No document displayed" };
  }

  return {
    ...context.currentResult,
    updating: true,  // 既存の結果を更新
    viewState: {
      ...context.currentResult.viewState,
      scrollToAnchor: args.anchorId,
    },
  };
};
```

#### パターン C: アプリ固有機能を使う

**参照:** [GUIChatPluginSwitchRole](https://github.com/nicedoc/GUIChatPluginSwitchRole)

```typescript
interface ExtendedContext extends ToolContext {
  app?: ToolContext["app"] & {
    getRoles?: () => Role[];
    switchRole?: (roleId: string) => void;
  };
}

export const executeSwitchRole = async (
  context: ExtendedContext,
  args: SwitchRoleArgs,
): Promise<ToolResult> => {
  const roles = context.app?.getRoles?.() || [];

  if (context.app?.switchRole) {
    setTimeout(() => context.app?.switchRole?.(args.role), 0);
  }

  return { message: `Switching to ${args.role}` };
};
```

---

## 共有 UI コンポーネント

複数のプラグインで共通の UI を使用する場合、共有パッケージを利用できます。

### @mulmochat-plugin/ui-image

画像表示用の共有コンポーネントを提供します。GenerateImage, EditImage などで使用。

```typescript
// src/vue/View.vue
import { ImageView } from "@mulmochat-plugin/ui-image";

// src/vue/Preview.vue
import { ImagePreview } from "@mulmochat-plugin/ui-image";
```

**package.json での設定:**

```json
{
  "peerDependencies": {
    "@mulmochat-plugin/ui-image": "^0.1.0"
  },
  "devDependencies": {
    "@mulmochat-plugin/ui-image": "^0.1.0"
  }
}
```

---

## 実装例: 画像生成プラグイン

画像生成プラグインは、`context.app.generateImage()` を使用し、`inputHandlers` でファイルアップロードを受け付ける例です。

**参照:** [@mulmochat-plugin/generate-image](https://www.npmjs.com/package/@mulmochat-plugin/generate-image)

### types.ts

```typescript
export interface ImageToolData {
  imageData: string;
  prompt?: string;
}

export interface GenerateImageArgs {
  prompt: string;
}
```

### definition.ts

```typescript
export const TOOL_NAME = "generateImage";

export const TOOL_DEFINITION: ToolDefinition = {
  type: "function",
  name: TOOL_NAME,
  description:
    "Generate an image based on the prompt and display it on the screen. Be descriptive and specify the concrete details of the images in the prompt. Each call generates one image.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "A detailed prompt describing the image to generate",
      },
    },
    required: ["prompt"],
  },
};

export const SYSTEM_PROMPT = `When you are talking about places, objects, people, movies, books and other things, you MUST use the ${TOOL_NAME} API to draw pictures to make the conversation more engaging.`;
```

### plugin.ts

```typescript
import type { ToolPluginCore, ToolContext, ToolResult } from "gui-chat-protocol";
import type { ImageToolData, GenerateImageArgs } from "./types";
import { TOOL_DEFINITION, TOOL_NAME, SYSTEM_PROMPT } from "./definition";
import { SAMPLES } from "./samples";

// ヘルパー: アップロード画像から ToolResult を作成
export function createUploadedImageResult(
  imageData: string,
  fileName: string,
  prompt: string,
): ToolResult<ImageToolData, never> {
  return {
    toolName: TOOL_NAME,
    data: { imageData, prompt },
    message: "",
    title: fileName,
  };
}

// execute: context.app.generateImage() の結果をそのまま返す
export const executeGenerateImage = async (
  context: ToolContext,
  args: GenerateImageArgs,
): Promise<ToolResult<ImageToolData, never>> => {
  const { prompt } = args;

  if (!context.app?.generateImage) {
    return { message: "generateImage function not available" };
  }

  // generateImage は ToolResult を返す
  return context.app.generateImage(prompt);
};

export const pluginCore: ToolPluginCore<ImageToolData, never, GenerateImageArgs> = {
  toolDefinition: TOOL_DEFINITION,
  execute: executeGenerateImage,
  generatingMessage: "Generating image...",
  isEnabled: () => true,
  inputHandlers: [
    {
      type: "file",
      acceptedTypes: ["image/png", "image/jpeg"],
      handleInput: (data: string, fileName?: string) =>
        createUploadedImageResult(data, fileName || "image.png", ""),
    },
    {
      type: "clipboard-image",
      handleInput: (data: string) =>
        createUploadedImageResult(data, "clipboard-image.png", ""),
    },
  ],
  systemPrompt: SYSTEM_PROMPT,
  backends: ["imageGen"],
  samples: SAMPLES,
};
```

### samples.ts

画像プラグインの samples はデモ用に pre-loaded 画像を含めます。

```typescript
import type { ToolSample } from "gui-chat-protocol";

// デモ用サンプル: imageData に URL を設定（実行時に画像として表示）
export const SAMPLES: ToolSample[] = [
  {
    name: "Sunset Beach",
    args: {
      imageData: "https://picsum.photos/id/28/800/600",
      prompt: "A beautiful sunset over a calm ocean beach with palm trees",
    },
  },
  {
    name: "Mountain Lake",
    args: {
      imageData: "https://picsum.photos/id/29/800/600",
      prompt: "A serene mountain lake surrounded by pine trees and snow-capped peaks",
    },
  },
  {
    name: "City Skyline",
    args: {
      imageData: "https://picsum.photos/id/43/800/600",
      prompt: "A modern city skyline at night with glowing skyscrapers",
    },
  },
  {
    name: "Forest Path",
    args: {
      imageData: "https://picsum.photos/id/15/800/600",
      prompt: "A winding path through an enchanted forest with sunlight filtering through the leaves",
    },
  },
];
```

### Vue コンポーネント（共有パッケージ使用）

```typescript
// src/vue/View.vue
<template>
  <ImageView v-if="currentResult" :selectedResult="currentResult" />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ImageView } from "@mulmochat-plugin/ui-image";
import { TOOL_NAME } from "../core/definition";
import type { ToolResult } from "gui-chat-protocol/vue";
import type { ImageToolData } from "../core/types";

const props = defineProps<{
  selectedResult: ToolResult<ImageToolData>;
}>();

const currentResult = ref<ToolResult<ImageToolData> | null>(null);

watch(
  () => props.selectedResult,
  (result) => {
    if (result?.toolName === TOOL_NAME && result.data) {
      currentResult.value = result;
    }
  },
  { immediate: true, deep: true },
);
</script>
```

```typescript
// src/vue/Preview.vue
<template>
  <ImagePreview :result="result" />
</template>

<script setup lang="ts">
import { ImagePreview } from "@mulmochat-plugin/ui-image";
import type { ToolResult } from "gui-chat-protocol/vue";
import type { ImageToolData } from "../core/types";

defineProps<{
  result: ToolResult<ImageToolData>;
}>();
</script>
```

---

## 参考プラグイン一覧

| プラグイン | 特徴 | 参照ポイント |
|-----------|------|-------------|
| **[@mulmochat-plugin/generate-image](https://www.npmjs.com/package/@mulmochat-plugin/generate-image)** | 画像生成 | inputHandlers, backends, 共有 UI |
| **[Othello](https://github.com/nicedoc/GUIChatPluginOthello)** | ゲーム、インタラクティブ UI | samples, sendTextMessage, jsonData |
| **[GenerateHtml](https://github.com/nicedoc/GUIChatPluginGenerateHtml)** | バックエンド呼び出し | context.app, isEnabled, backends |
| **[ScrollToAnchor](https://github.com/nicedoc/GUIChatPluginScrollToAnchor)** | 結果更新 | updating, viewState, currentResult |
| **[SwitchRole](https://github.com/nicedoc/GUIChatPluginSwitchRole)** | アプリ機能呼び出し | context 拡張、カスタム関数 |
| **[Quiz](https://github.com/receptron/MulmoChatPluginQuiz)** | シンプルなデータ表示 | samples, View, Preview |
| **[Spreadsheet](https://github.com/nicedoc/GUIChatPluginSpreadsheet)** | 複雑なロジック | logic.ts 分離、フォーミュラ計算 |

---

## 完了チェックリスト

### 必須ファイル

- [ ] `package.json` - name: `@gui-chat-plugin/xxx`, description, keywords
- [ ] `vite.config.ts` - name: `GUIChatPluginXxx`
- [ ] `tsconfig.json`
- [ ] `tsconfig.build.json`
- [ ] `eslint.config.js`
- [ ] `.gitignore`
- [ ] `index.html` - タイトルを変更
- [ ] `README.md` - プラグイン説明、インストール方法、Test Prompts
- [ ] `.github/workflows/pull_request.yaml`

### src ファイル

- [ ] `src/style.css` - `@import "tailwindcss";`
- [ ] `src/index.ts` - `export * from "./core";`
- [ ] **Tailwind arbitrary values 禁止** - 標準クラスのみ使用（`bg-[#xxx]`、`w-[xxx]` 等は使用不可）

### Core ファイル

- [ ] `src/core/types.ts` - XxxToolData, XxxArgs, (XxxJsonData)
- [ ] `src/core/definition.ts` - TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT
- [ ] `src/core/plugin.ts` - executeXxx, pluginCore
- [ ] `src/core/index.ts` - すべてをエクスポート
- [ ] `src/core/samples.ts` - テスト用サンプル

### Vue ファイル

- [ ] `src/vue/index.ts` - plugin, エクスポート, `export default { plugin }`
- [ ] `src/vue/View.vue` - `selectedResult` props、`sendTextMessage` props
- [ ] `src/vue/Preview.vue` - `result` props

### Demo ファイル

- [ ] `demo/main.ts`
- [ ] `demo/App.vue` - samples ボタン、View 表示、Preview 表示

### ビルド検証

- [ ] `yarn install` 成功
- [ ] `yarn typecheck` エラーなし
- [ ] `yarn lint` エラーなし
- [ ] `yarn build` 成功
- [ ] `yarn dev` でデモ動作確認

### MulmoChat 統合

- [ ] `package.json` に追加: `"@gui-chat-plugin/xxx": "file:../GUIChatPluginXxx"`
- [ ] `src/tools/index.ts` にインポート追加
- [ ] `src/main.ts` に CSS インポート追加
- [ ] MulmoChat で `yarn install`
- [ ] MulmoChat で `yarn typecheck` エラーなし
- [ ] MulmoChat で `yarn lint` エラーなし

---

## AI への指示テンプレート

### 新規プラグイン作成

> **重要**: プラグインの品質は、提供する仕様の詳細度に依存します。
> パラメータの型、取りうる値、UI の動作を具体的に記述してください。

```
GUIChat プラグインを新規作成してください。

プラグイン名: @gui-chat-plugin/xxx
機能: {機能の詳細説明}

Tool Definition:
- name: xxxTool
- description: {LLM への説明}
- parameters:
  - paramName (type): {説明}
    - 必須/オプション
    - 取りうる値（enum の場合はリスト）
    - デフォルト値

実装要件:
- View: {メイン画面の表示方法、不要なら「なし」}
  - 表示するコンテンツ
  - ユーザーインタラクション
  - 特殊な UI 要素（ダウンロードボタン等）
- Preview: {サムネイルの表示方法、不要なら「なし」}
- Backend: {使用するバックエンド、なしなら「なし」}
- Samples: {テスト用サンプル}
- ドメインロジック: {必要な計算、ルール、アルゴリズム}

参照: docs/plugin-development-guide.md の手順に従い、
チェックリストで漏れがないか確認してください。
```

### 既存プラグインの独立化

```
MulmoChat の内部プラグイン {pluginName} を独立した npm パッケージとして抽出してください。

ソースファイル:
- src/tools/models/{pluginName}.ts
- src/tools/views/{PluginName}.vue
- src/tools/previews/{PluginName}.vue

参照: docs/plugin-extraction-guide.md の手順に従い、
チェックリストで漏れがないか確認してください。
```
