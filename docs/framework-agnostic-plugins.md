# フレームワーク非依存プラグインアーキテクチャ

## サマリー

MulmoChatプラグインをVue以外のフレームワーク（React、Astro、Svelte等）でも利用可能にするための設計。

### 設計方針

| 項目 | 決定 |
|------|------|
| **型定義** | `gui-chat-protocol` npm パッケージとして独立 |
| **プラグイン構造** | `core/` (ロジック) + `vue/` or `react/` (UI) に分離 |
| **設定UI** | JSON Schemaで定義（Vueコンポーネント不要） |
| **CSS** | Tailwind CSS |
| **外部入力** | `InputHandler` で統一（file, clipboard, camera, url, audio） |

### gui-chat-protocol パッケージ

```
gui-chat-protocol
├── index.ts    # Core: ToolPluginCore, ToolContext, ToolResult, etc.
├── vue.ts      # Vue: ToolPluginVue, ToolPlugin (alias)
└── react.ts    # React: ToolPluginReact
```

### プラグイン構造（移行後）

```
@mulmochat-plugin/quiz
├── core/       # ToolPluginCore + execute + TOOL_DEFINITION
├── vue/        # View.vue + Preview.vue → ToolPluginVue
└── react/      # View.tsx + Preview.tsx → ToolPluginReact
```

### TODO

- [ ] **Phase 0**: `gui-chat-protocol` パッケージ作成・公開
  - [ ] コア型定義 (`index.ts`) - ToolPluginCore, ToolContext, ToolResult, InputHandler, PluginConfigSchema
  - [ ] Vue型定義 (`vue.ts`) - ToolPluginVue, ToolPlugin
  - [ ] React型定義 (`react.ts`) - ToolPluginReact
- [ ] **Phase 1**: MulmoChat本体の型定義を `gui-chat-protocol/vue` に移行
- [ ] **Phase 2**: 内蔵プラグインのViewComponentProps/PreviewComponentPropsを標準化
- [ ] **Phase 3**: 外部プラグイン (Quiz) の `src/common` を削除し `gui-chat-protocol` に移行
- [ ] **Phase 4**: Quiz プラグインの React 実装（View.tsx, Preview.tsx）
- [ ] **Phase 5**: 他の外部プラグイン (GenerateImage, Form, SummarizePdf) に展開

### 将来の拡張提案（実装未定）

| 提案 | 概要 | 優先度 |
|------|------|--------|
| リソース参照 | `context.results.getById(uuid)` で過去の結果を参照 | 高 |
| Capabilities | ツールの機能宣言（outputType, streaming, undoable等） | 高 |
| ワークスペース | 複数結果を構造化（プレゼン、レポート等） | 中 |
| ストリーミング | `executeStream` + `onProgress` コールバック | 中 |
| Undo/履歴 | `onUndo`, `onRedo`, `shouldSaveToHistory` | 低 |

---

## 概要

MulmoChatプラグインをVue以外のフレームワーク（React、Astro、Svelte等）でも利用可能にするための設計ドキュメント。

---

## 現状分析

### 良い点：既に分離されている部分

現在のプラグインアーキテクチャは、ロジック層とUI層がファイルレベルで分離されている。

```
src/tools/models/othello.ts    ← ロジック（フレームワーク非依存）
src/tools/views/othello.vue    ← UI（Vue依存）
src/tools/previews/othello.vue ← プレビュー（Vue依存）
```

#### フレームワーク非依存のコード

| コンポーネント | 場所 | 依存 |
|--------------|------|------|
| `toolDefinition` | `.ts` ファイル | なし（純粋なJSONスキーマ） |
| `execute()` 関数 | `.ts` ファイル | `ToolContext` のみ |
| `ToolResult` インターフェース | 型定義 | なし |
| ビジネスロジック | バックエンド関数 | HTTP API、アルゴリズム |
| `isEnabled()` チェック | `.ts` ファイル | なし |

#### Vue依存のコード

| コンポーネント | 場所 | Vue依存 |
|--------------|------|---------|
| `viewComponent` | `.vue` ファイル | `<script setup>`, `ref()`, `watch()`, `computed()` |
| `previewComponent` | `.vue` ファイル | Vueコンポーネントライフサイクル |
| UIレンダリング | テンプレート構文 | `v-if`, `v-for`, `@click` 等 |

### 問題点

#### 1. ToolPluginインターフェースにUIコンポーネントが混在

```typescript
// src/tools/types.ts - 現状
export interface ToolPlugin<T, J, A extends object> {
  // フレームワーク非依存
  toolDefinition: ToolDefinition;
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;
  isEnabled: (startResponse?: StartApiResponse | null) => boolean;

  // Vue依存 - ここが問題
  viewComponent?: VueComponent;
  previewComponent?: VueComponent;

  // その他
  systemPrompt?: string;
  backends?: BackendType[];
}
```

#### 2. 外部プラグインパッケージがVueをバンドル

```typescript
// @mulmochat-plugin/quiz のエクスポート - 現状
import View from "./View.vue";
import Preview from "./Preview.vue";

export const plugin: ToolPlugin = {
  // ...
  viewComponent: View,      // Vueコンポーネントがバンドルされる
  previewComponent: Preview,
};
```

**問題:**
- Reactアプリで使用する際もVueコンポーネントがバンドルに含まれる
- Vueが peer dependency として必要

#### 3. コンポーネントのpropsインターフェースが暗黙的

Viewコンポーネントが受け取るpropsが明示的に定義されていない。

```typescript
// 現状：App.vue で動的に渡される
<component
  :is="getToolPlugin(selectedResult.toolName!).viewComponent"
  :selected-result="selectedResult"
  :send-text-message="sendTextMessage"
  :google-map-key="startResponse?.googleMapKey"
  @update-result="handleUpdateResult"
/>
```

各コンポーネントが独自にpropsを定義しており、一貫性がない。

---

## GUI-Chat-Protocol パッケージ

プラグインの共通型定義を独立したnpmパッケージとして切り出す。

### パッケージ構成

```
gui-chat-protocol/
├── src/
│   ├── index.ts           # Core exports (フレームワーク非依存)
│   ├── vue.ts             # Vue固有の型定義
│   └── react.ts           # React固有の型定義
│
├── package.json
├── tsconfig.json
└── README.md
```

### package.json exports

```json
{
  "name": "gui-chat-protocol",
  "version": "1.0.0",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./vue": {
      "types": "./dist/vue.d.ts",
      "import": "./dist/vue.js",
      "require": "./dist/vue.cjs"
    },
    "./react": {
      "types": "./dist/react.d.ts",
      "import": "./dist/react.js",
      "require": "./dist/react.cjs"
    }
  },
  "peerDependencies": {
    "vue": "^3.5.0",
    "react": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "vue": { "optional": true },
    "react": { "optional": true }
  }
}
```

### Core exports (index.ts)

フレームワークに依存しない型のみをエクスポート。

```typescript
// gui-chat-protocol/src/index.ts

/**
 * バックエンド種別
 */
export type BackendType =
  | "textLLM"
  | "imageGen"
  | "audio"
  | "search"
  | "browse"
  | "map"
  | "mulmocast";

/**
 * アプリ層が提供するインターフェース
 */
export interface ToolContextApp extends Record<string, (...args: any[]) => any> {
  getConfig: <T = unknown>(key: string) => T | undefined;
  setConfig: (key: string, value: unknown) => void;
}

/**
 * ツール実行時のコンテキスト
 */
export interface ToolContext {
  currentResult?: ToolResult<unknown> | null;
  app?: ToolContextApp;
}

/**
 * ツール実行結果
 */
export interface ToolResult<T = unknown, J = unknown> {
  toolName?: string;
  uuid?: string;
  message: string;
  title?: string;
  jsonData?: J;
  instructions?: string;
  instructionsRequired?: boolean;
  updating?: boolean;
  cancelled?: boolean;
  data?: T;
  viewState?: Record<string, unknown>;
}

/**
 * 完全なツール結果（必須フィールド付き）
 */
export interface ToolResultComplete<T = unknown, J = unknown>
  extends ToolResult<T, J> {
  toolName: string;
  uuid: string;
}

/**
 * JSON Schemaプロパティ定義
 */
export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  oneOf?: JsonSchemaProperty[];
  [key: string]: unknown;
}

/**
 * ツール定義（OpenAI Function Calling互換）
 */
export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
    additionalProperties?: boolean;
  };
}

/**
 * サーバーAPI応答
 */
export interface StartApiResponse {
  hasOpenAIApiKey?: boolean;
  hasAnthropicApiKey?: boolean;
  hasGoogleApiKey?: boolean;
  [key: string]: unknown;
}

/**
 * サンプル引数（テスト用）
 */
export interface ToolSample {
  name: string;
  args: Record<string, unknown>;
}

/**
 * 外部入力ハンドラー
 */
export type InputHandler =
  | FileInputHandler
  | ClipboardImageInputHandler
  | UrlInputHandler
  | TextInputHandler
  | CameraInputHandler
  | AudioInputHandler;

export interface FileInputHandler {
  type: "file";
  acceptedTypes: string[];
  handleInput: (fileData: string, fileName: string) => ToolResult;
}

export interface ClipboardImageInputHandler {
  type: "clipboard-image";
  handleInput: (imageData: string) => ToolResult;
}

export interface UrlInputHandler {
  type: "url";
  patterns?: string[];
  handleInput: (url: string) => ToolResult;
}

export interface TextInputHandler {
  type: "text";
  patterns?: string[];
  handleInput: (text: string) => ToolResult;
}

export interface CameraInputHandler {
  type: "camera";
  mode: "photo" | "video";
  handleInput: (data: string, metadata?: { duration?: number }) => ToolResult;
}

export interface AudioInputHandler {
  type: "audio";
  handleInput: (audioData: string, duration: number) => ToolResult;
}

/**
 * プラグイン設定スキーマ（JSON Schema ベース）
 */
export interface PluginConfigSchema {
  key: string;
  defaultValue: ConfigValue;
  schema: ConfigFieldSchema;
}

export type ConfigValue = string | number | boolean | string[];

export type ConfigFieldSchema =
  | StringFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema
  | SelectFieldSchema
  | MultiSelectFieldSchema;

interface BaseFieldSchema {
  label: string;
  description?: string;
  required?: boolean;
}

export interface StringFieldSchema extends BaseFieldSchema {
  type: "string";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface NumberFieldSchema extends BaseFieldSchema {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanFieldSchema extends BaseFieldSchema {
  type: "boolean";
}

export interface SelectFieldSchema extends BaseFieldSchema {
  type: "select";
  options: SelectOption[];
}

export interface MultiSelectFieldSchema extends BaseFieldSchema {
  type: "multiselect";
  options: SelectOption[];
  minItems?: number;
  maxItems?: number;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Viewコンポーネントの標準props（フレームワーク非依存の定義）
 */
export interface ViewComponentProps<T = unknown, J = unknown> {
  selectedResult: ToolResultComplete<T, J>;
  sendTextMessage: (text?: string) => void;
  onUpdateResult?: (result: Partial<ToolResult<T, J>>) => void;
  pluginConfigs?: Record<string, unknown>;
}

/**
 * Previewコンポーネントの標準props
 */
export interface PreviewComponentProps<T = unknown, J = unknown> {
  result: ToolResultComplete<T, J>;
  isSelected?: boolean;
  onSelect?: () => void;
}

/**
 * コアプラグインインターフェース（フレームワーク非依存）
 */
export interface ToolPluginCore<
  T = unknown,
  J = unknown,
  A extends object = object,
> {
  toolDefinition: ToolDefinition;
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;
  waitingMessage?: string;
  uploadMessage?: string;
  isEnabled: (startResponse?: StartApiResponse | null) => boolean;
  delayAfterExecution?: number;
  systemPrompt?: string;
  inputHandlers?: InputHandler[];
  config?: PluginConfigSchema;
  samples?: ToolSample[];
  backends?: BackendType[];
}
```

### Vue exports (vue.ts)

Vue固有の型をエクスポート。Vueを使うプラグイン/アプリはこちらをインポート。

```typescript
// gui-chat-protocol/src/vue.ts
import type { Component } from "vue";
import type {
  ToolPluginCore,
  ToolResult,
  StartApiResponse,
  ToolContext,
  ToolDefinition,
  InputHandler,
  PluginConfigSchema,
  ToolSample,
  BackendType,
} from "./index";

// Core型を再エクスポート
export * from "./index";

/**
 * Vue用プラグイン設定（Vueコンポーネントベース）
 * @deprecated JSON Schema (PluginConfigSchema) を使用してください
 */
export interface ToolPluginConfigVue {
  key: string;
  defaultValue: unknown;
  component: Component;
}

/**
 * Vue用プラグインインターフェース
 */
export interface ToolPluginVue<
  T = unknown,
  J = unknown,
  A extends object = object,
> extends ToolPluginCore<T, J, A> {
  /** メインビューコンポーネント */
  viewComponent?: Component;

  /** プレビュー/サムネイルコンポーネント */
  previewComponent?: Component;

  /**
   * Vue コンポーネントベースの設定
   * @deprecated config (PluginConfigSchema) を使用してください
   */
  legacyConfig?: ToolPluginConfigVue;
}

/**
 * ToolPlugin の後方互換エイリアス
 */
export type ToolPlugin<
  T = unknown,
  J = unknown,
  A extends object = object,
> = ToolPluginVue<T, J, A>;
```

### React exports (react.ts)

React固有の型をエクスポート。Reactを使うプラグイン/アプリはこちらをインポート。

```typescript
// gui-chat-protocol/src/react.ts
import type { ComponentType } from "react";
import type {
  ToolPluginCore,
  ViewComponentProps,
  PreviewComponentProps,
} from "./index";

// Core型を再エクスポート
export * from "./index";

/**
 * React用プラグインインターフェース
 */
export interface ToolPluginReact<
  T = unknown,
  J = unknown,
  A extends object = object,
> extends ToolPluginCore<T, J, A> {
  /** メインビューコンポーネント */
  ViewComponent?: ComponentType<ViewComponentProps<T, J>>;

  /** プレビュー/サムネイルコンポーネント */
  PreviewComponent?: ComponentType<PreviewComponentProps<T, J>>;
}
```

### 型の分類

| 型 | エクスポート元 | 依存 |
|---|---|---|
| `BackendType` | `.` (core) | なし |
| `ToolContext` | `.` (core) | なし |
| `ToolContextApp` | `.` (core) | なし |
| `ToolResult` | `.` (core) | なし |
| `ToolResultComplete` | `.` (core) | なし |
| `JsonSchemaProperty` | `.` (core) | なし |
| `ToolDefinition` | `.` (core) | なし |
| `StartApiResponse` | `.` (core) | なし |
| `ToolSample` | `.` (core) | なし |
| `InputHandler` | `.` (core) | なし |
| `PluginConfigSchema` | `.` (core) | なし |
| `ViewComponentProps` | `.` (core) | なし |
| `PreviewComponentProps` | `.` (core) | なし |
| `ToolPluginCore` | `.` (core) | なし |
| `ToolPluginVue` | `./vue` | Vue |
| `ToolPlugin` (alias) | `./vue` | Vue |
| `ToolPluginReact` | `./react` | React |

### 使用例

```typescript
// コアロジックのみ（UIなし）
import type { ToolPluginCore, ToolContext, ToolResult } from "gui-chat-protocol";

// Vueアプリケーション
import type { ToolPluginVue, ToolPlugin } from "gui-chat-protocol/vue";

// Reactアプリケーション
import type { ToolPluginReact } from "gui-chat-protocol/react";
```

### プラグインでの使用

```typescript
// プラグインのsrc/core/index.ts
import type { ToolPluginCore } from "gui-chat-protocol";
import { executeQuiz } from "./execute";
import { TOOL_DEFINITION } from "./tools";

export const corePlugin: ToolPluginCore<never, QuizData, QuizArgs> = {
  toolDefinition: TOOL_DEFINITION,
  execute: executeQuiz,
  generatingMessage: "Preparing quiz...",
  isEnabled: () => true,
};

// プラグインのsrc/vue/index.ts
import type { ToolPluginVue } from "gui-chat-protocol/vue";
import { corePlugin } from "../core";
import View from "./View.vue";
import Preview from "./Preview.vue";

export const plugin: ToolPluginVue<never, QuizData, QuizArgs> = {
  ...corePlugin,
  viewComponent: View,
  previewComponent: Preview,
};

// プラグインのsrc/react/index.tsx
import type { ToolPluginReact } from "gui-chat-protocol/react";
import { corePlugin } from "../core";
import { View } from "./View";
import { Preview } from "./Preview";

export const plugin: ToolPluginReact<never, QuizData, QuizArgs> = {
  ...corePlugin,
  ViewComponent: View,
  PreviewComponent: Preview,
};
```

---

## 外部プラグインの現状構造

### 現在のディレクトリ構成（移行前）

```
@mulmochat-plugin/quiz/
├── src/
│   ├── common/              ← 共通型定義（MulmoChatからコピー）※廃止予定
│   │   ├── index.ts
│   │   └── types.ts         ← ToolPlugin, ToolContext, ToolResult 等
│   │
│   ├── plugin/              ← プラグイン本体
│   │   ├── index.ts         ← plugin エクスポート（Vue込み）
│   │   ├── tools.ts         ← TOOL_DEFINITION（フレームワーク非依存）
│   │   ├── types.ts         ← QuizData, QuizArgs（フレームワーク非依存）
│   │   ├── samples.ts       ← テスト用サンプル（フレームワーク非依存）
│   │   ├── View.vue         ← メインビュー（Vue依存）
│   │   └── Preview.vue      ← サムネイル（Vue依存）
│   │
│   ├── index.ts             ← パッケージエントリポイント
│   └── shims-vue.d.ts
│
├── demo/                    ← 開発用デモ
│   ├── App.vue
│   └── main.ts
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tsconfig.build.json
```

### 現在の plugin/index.ts（移行前）

```typescript
// src/plugin/index.ts - 現状
import type { ToolPlugin, ToolContext, ToolResult } from "../common"; // ← gui-chat-protocol に移行
import { TOOL_DEFINITION } from "./tools";
import type { QuizData, QuizArgs } from "./types";
import { SAMPLES } from "./samples";
import View from "./View.vue";      // ← Vue依存
import Preview from "./Preview.vue"; // ← Vue依存

const putQuestions = async (
  _context: ToolContext,
  args: QuizArgs,
): Promise<ToolResult<never, QuizData>> => {
  // ビジネスロジック（フレームワーク非依存）
  const { title, questions } = args;
  // バリデーション等...
  return {
    message: `Quiz presented with ${questions.length} questions`,
    jsonData: { title, questions },
    instructions: "Wait for user answers...",
  };
};

export const plugin: ToolPlugin<never, QuizData, QuizArgs> = {
  toolDefinition: TOOL_DEFINITION,
  execute: putQuestions,
  generatingMessage: "Preparing quiz...",
  isEnabled: () => true,
  viewComponent: View,       // ← Vue依存
  previewComponent: Preview, // ← Vue依存
  samples: SAMPLES,
};
```

### 現在の package.json exports（移行前）

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./style.css": "./dist/style.css"
  },
  "dependencies": {
    "gui-chat-protocol": "^1.0.0"  // ← NEW: 型定義パッケージ
  },
  "peerDependencies": {
    "vue": "^3.5.0"  // ← Vue必須
  }
}
```

---

## 提案: 新しいディレクトリ構成

### core/vue/react 分離構造

`src/common`を廃止し、`gui-chat-protocol`パッケージから型をインポート。

```
@mulmochat-plugin/quiz/
├── src/
│   ├── core/                ← フレームワーク非依存
│   │   ├── index.ts         ← コアプラグインエクスポート
│   │   ├── execute.ts       ← execute関数
│   │   ├── tools.ts         ← TOOL_DEFINITION
│   │   ├── types.ts         ← QuizData, QuizArgs（プラグイン固有の型）
│   │   └── samples.ts       ← テスト用サンプル
│   │
│   ├── vue/                 ← Vueアダプター
│   │   ├── index.ts         ← Vueプラグインエクスポート
│   │   ├── View.vue
│   │   └── Preview.vue
│   │
│   ├── react/               ← Reactアダプター
│   │   ├── index.tsx        ← Reactプラグインエクスポート
│   │   ├── View.tsx
│   │   └── Preview.tsx
│   │
│   └── index.ts             ← デフォルトエクスポート（後方互換: vue）
│
├── demo/
│   ├── vue/                 ← Vueデモ
│   │   ├── App.vue
│   │   └── main.ts
│   └── react/               ← Reactデモ
│       ├── App.tsx
│       └── main.tsx
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 新しい core/index.ts

```typescript
// src/core/index.ts - フレームワーク非依存
import type { ToolPluginCore } from "gui-chat-protocol";  // ← パッケージからインポート
import { TOOL_DEFINITION } from "./tools";
import { executeQuiz } from "./execute";
import type { QuizData, QuizArgs } from "./types";
import { SAMPLES } from "./samples";

// 型のエクスポート
export type { QuizData, QuizArgs, QuizQuestion } from "./types";

// コアプラグイン（UIなし）
export const corePlugin: ToolPluginCore<never, QuizData, QuizArgs> = {
  toolDefinition: TOOL_DEFINITION,
  execute: executeQuiz,
  generatingMessage: "Preparing quiz...",
  isEnabled: () => true,
  samples: SAMPLES,
};
```

### 新しい vue/index.ts

```typescript
// src/vue/index.ts - Vueアダプター
import type { ToolPluginVue } from "gui-chat-protocol/vue";  // ← Vue用エクスポート
import { corePlugin } from "../core";
import type { QuizData, QuizArgs } from "../core";
import View from "./View.vue";
import Preview from "./Preview.vue";

// 型の再エクスポート
export type { QuizData, QuizArgs } from "../core";

// Vueプラグイン
export const plugin: ToolPluginVue<never, QuizData, QuizArgs> = {
  ...corePlugin,
  viewComponent: View,
  previewComponent: Preview,
};

// デフォルトエクスポート
export default { plugin };
```

### 新しい react/index.tsx

```tsx
// src/react/index.tsx - Reactアダプター
import type { ToolPluginReact } from "gui-chat-protocol/react";  // ← React用エクスポート
import { corePlugin } from "../core";
import type { QuizData, QuizArgs } from "../core";
import { View } from "./View";
import { Preview } from "./Preview";

// 型の再エクスポート
export type { QuizData, QuizArgs } from "../core";

// Reactプラグイン
export const plugin: ToolPluginReact<never, QuizData, QuizArgs> = {
  ...corePlugin,
  ViewComponent: View,
  PreviewComponent: Preview,
};

// デフォルトエクスポート
export default { plugin };
```

### 新しい package.json exports

```json
{
  "name": "@mulmochat-plugin/quiz",
  "exports": {
    ".": {
      "types": "./dist/core/index.d.ts",
      "import": "./dist/core/index.js",
      "require": "./dist/core/index.cjs"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js",
      "require": "./dist/vue/index.cjs"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js",
      "require": "./dist/react/index.cjs"
    },
    "./style.css": "./dist/style.css"
  },
  "dependencies": {
    "gui-chat-protocol": "^1.0.0"  // ← 型定義パッケージを依存に追加
  },
  "peerDependencies": {
    "vue": "^3.5.0",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "vue": { "optional": true },
    "react": { "optional": true },
    "react-dom": { "optional": true }
  }
}
```

---

## React実装方針

### Viewコンポーネントの変換パターン

VueコンポーネントをReactに変換する際の対応表。

#### 基本構造

```vue
<!-- Vue -->
<template>
  <div class="container">
    <h1>{{ title }}</h1>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";

const props = defineProps<{
  selectedResult: ToolResult;
  sendTextMessage: (text?: string) => void;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();
</script>
```

```tsx
// React
import { useState, useEffect, useMemo } from "react";

interface Props {
  selectedResult: ToolResult;
  sendTextMessage: (text?: string) => void;
  onUpdateResult?: (result: ToolResult) => void;
}

export function View({ selectedResult, sendTextMessage, onUpdateResult }: Props) {
  return (
    <div className="container">
      <h1>{title}</h1>
    </div>
  );
}
```

#### 状態管理

| Vue | React |
|-----|-------|
| `ref(initialValue)` | `useState(initialValue)` |
| `reactive({...})` | `useState({...})` または複数の `useState` |
| `computed(() => ...)` | `useMemo(() => ..., [deps])` |
| `watch(() => x, (newVal) => {...})` | `useEffect(() => {...}, [x])` |

```vue
<!-- Vue -->
<script setup>
const count = ref(0);
const doubled = computed(() => count.value * 2);

watch(() => props.selectedResult, (newResult) => {
  if (newResult?.jsonData) {
    count.value = newResult.jsonData.count;
  }
}, { immediate: true });
</script>
```

```tsx
// React
const [count, setCount] = useState(0);
const doubled = useMemo(() => count * 2, [count]);

useEffect(() => {
  if (selectedResult?.jsonData) {
    setCount(selectedResult.jsonData.count);
  }
}, [selectedResult]);
```

#### イベントハンドリング

| Vue | React |
|-----|-------|
| `@click="handler"` | `onClick={handler}` |
| `@input="handler"` | `onChange={handler}` |
| `v-model="value"` | `value={value} onChange={e => setValue(e.target.value)}` |
| `emit('updateResult', result)` | `onUpdateResult?.(result)` |

```vue
<!-- Vue -->
<input v-model="text" @keydown.enter="submit" />
<button @click="handleClick">Submit</button>
```

```tsx
// React
<input
  value={text}
  onChange={e => setText(e.target.value)}
  onKeyDown={e => e.key === 'Enter' && submit()}
/>
<button onClick={handleClick}>Submit</button>
```

#### 条件付きレンダリング

| Vue | React |
|-----|-------|
| `v-if="condition"` | `{condition && <Component />}` |
| `v-else` | 三項演算子 `{condition ? <A /> : <B />}` |
| `v-show="condition"` | `style={{ display: condition ? 'block' : 'none' }}` |
| `v-for="item in items"` | `{items.map(item => <Component key={item.id} />)}` |

```vue
<!-- Vue -->
<div v-if="loading">Loading...</div>
<div v-else-if="error">Error: {{ error }}</div>
<ul v-else>
  <li v-for="item in items" :key="item.id">{{ item.name }}</li>
</ul>
```

```tsx
// React
{loading ? (
  <div>Loading...</div>
) : error ? (
  <div>Error: {error}</div>
) : (
  <ul>
    {items.map(item => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
)}
```

### Quiz View.tsx 実装例

```tsx
// src/react/View.tsx
import { useState, useEffect, useMemo } from "react";
import type { ViewComponentProps } from "gui-chat-protocol";
import type { QuizData } from "../core";

export function View({
  selectedResult,
  sendTextMessage,
  onUpdateResult
}: ViewComponentProps<never, QuizData>) {
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);

  const quizData = selectedResult?.jsonData as QuizData | undefined;

  // Initialize answers when result changes
  useEffect(() => {
    if (quizData) {
      const savedAnswers = selectedResult?.viewState?.userAnswers as (number | null)[] | undefined;
      setUserAnswers(savedAnswers ?? new Array(quizData.questions.length).fill(null));
    }
  }, [selectedResult?.uuid]);

  // Save answers to viewState
  useEffect(() => {
    if (selectedResult && userAnswers.length > 0) {
      onUpdateResult?.({
        ...selectedResult,
        viewState: { userAnswers },
      });
    }
  }, [userAnswers]);

  const answeredCount = useMemo(() =>
    userAnswers.filter(a => a !== null).length,
    [userAnswers]
  );

  const allAnswered = quizData && answeredCount === quizData.questions.length;

  const handleAnswerChange = (qIndex: number, cIndex: number) => {
    setUserAnswers(prev => {
      const next = [...prev];
      next[qIndex] = cIndex;
      return next;
    });
  };

  const handleSubmit = () => {
    if (!quizData || !allAnswered) return;

    const answerText = userAnswers
      .map((answer, index) => {
        if (answer === null) return null;
        const choiceLetter = String.fromCharCode(65 + answer);
        const choiceText = quizData.questions[index].choices[answer];
        return `Q${index + 1}: ${choiceLetter} - ${choiceText}`;
      })
      .filter(Boolean)
      .join("\n");

    sendTextMessage(`Here are my answers:\n${answerText}`);
  };

  if (!quizData) return null;

  return (
    <div className="size-full overflow-y-auto p-8 bg-[#1a1a2e]">
      <div className="max-w-3xl w-full mx-auto">
        {quizData.title && (
          <h2 className="text-[#f0f0f0] text-3xl font-bold mb-8 text-center">
            {quizData.title}
          </h2>
        )}

        <div className="flex flex-col gap-6">
          {quizData.questions.map((question, qIndex) => (
            <div
              key={qIndex}
              className="bg-[#2d2d44] rounded-lg p-6 border-2 border-[#3d3d5c]"
            >
              <div className="text-white text-lg font-semibold mb-4">
                <span className="text-blue-400 mr-2">{qIndex + 1}.</span>
                {question.question}
              </div>

              <div className="flex flex-col gap-3">
                {question.choices.map((choice, cIndex) => {
                  const isSelected = userAnswers[qIndex] === cIndex;
                  return (
                    <label
                      key={cIndex}
                      className={`flex items-start p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/20"
                          : "border-[#4b4b6b] hover:border-[#6b6b8b] hover:bg-[#6b6b8b]/20"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${qIndex}`}
                        checked={isSelected}
                        onChange={() => handleAnswerChange(qIndex, cIndex)}
                        className="mt-1 mr-3 size-4 shrink-0"
                      />
                      <span className="text-white flex-1">
                        <span className="font-semibold mr-2">
                          {String.fromCharCode(65 + cIndex)}.
                        </span>
                        {choice}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`py-3 px-8 rounded-lg text-white font-semibold text-lg transition-colors border-none cursor-pointer ${
              allAnswered
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-600 cursor-not-allowed opacity-50"
            }`}
          >
            Submit Answers
          </button>
        </div>

        <div className="mt-4 text-center text-gray-400 text-sm">
          {answeredCount} / {quizData.questions.length} questions answered
        </div>
      </div>
    </div>
  );
}
```

### Quiz Preview.tsx 実装例

```tsx
// src/react/Preview.tsx
import type { PreviewComponentProps } from "gui-chat-protocol";
import type { QuizData } from "../core";

export function Preview({
  result,
  isSelected,
  onSelect
}: PreviewComponentProps<never, QuizData>) {
  const quizData = result?.jsonData;
  const questionCount = quizData?.questions?.length ?? 0;

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? "bg-blue-100 border-2 border-blue-500"
          : "bg-gray-100 hover:bg-gray-200"
      }`}
    >
      <div className="text-center">
        <div className="text-2xl mb-2">📝</div>
        <div className="font-medium text-gray-800">
          {quizData?.title || "Quiz"}
        </div>
        <div className="text-sm text-gray-500">
          {questionCount} question{questionCount !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
```

---

## 解決方針

### 1. インターフェースの分離

`gui-chat-protocol`パッケージで型を定義（詳細は上記「GUI-Chat-Protocol パッケージ」セクション参照）。

```typescript
// gui-chat-protocol からインポート
import type { ToolPluginCore } from "gui-chat-protocol";
import type { ToolPluginVue } from "gui-chat-protocol/vue";
import type { ToolPluginReact } from "gui-chat-protocol/react";
```

### 2. コンポーネントpropsの標準化

フレームワーク間で共通のpropsインターフェースは`gui-chat-protocol`で定義（詳細は上記セクション参照）。

```typescript
// gui-chat-protocol からインポート
import type { ViewComponentProps, PreviewComponentProps } from "gui-chat-protocol";
```

### 3. パッケージ構造の変更

外部プラグインの新構造（詳細は上記「提案: 新しいディレクトリ構成」セクション参照）。

- `src/common/`を削除し、`gui-chat-protocol`パッケージを依存に追加
- `core/`, `vue/`, `react/`の3エントリポイントでエクスポート

#### 使用例

```typescript
// Vueアプリケーション
import QuizPlugin from "@mulmochat-plugin/quiz/vue";

// Reactアプリケーション
import QuizPlugin from "@mulmochat-plugin/quiz/react";

// コアロジックのみ（UIなし）
import { corePlugin } from "@mulmochat-plugin/quiz";
```

---

## 実装計画

### Phase 0: GUI-Chat-Protocol パッケージ作成

1. `gui-chat-protocol` npm パッケージを作成
2. コア型定義（`index.ts`）を実装
3. Vue型定義（`vue.ts`）を実装
4. React型定義（`react.ts`）を実装
5. npmに公開

**成果物:**
- `gui-chat-protocol/` リポジトリ
- npm: `gui-chat-protocol`

### Phase 1: MulmoChat本体の型定義更新

1. `src/tools/types.ts` を `gui-chat-protocol/vue` からインポートに変更
2. 不要になった型定義を削除
3. `src/tools/backendTypes.ts` は維持（アプリ固有設定）

**対象ファイル:**
- `src/tools/types.ts`

### Phase 2: 内蔵プラグインのリファクタリング

1. 内蔵プラグインのViewコンポーネントを標準propsに統一
2. Previewコンポーネントを標準propsに統一

**対象ファイル:**
- `src/tools/views/*.vue`
- `src/tools/previews/*.vue`
- `src/views/HomeView.vue`（props渡し部分）

### Phase 3: 外部プラグインの移行（Quiz）

1. `src/common/` を削除し `gui-chat-protocol` を依存に追加
2. `core/` ディレクトリにロジックを移動
3. `vue/` ディレクトリにVueコンポーネントを移動
4. ビルド設定を更新
5. package.json の exports を設定

**対象リポジトリ:**
- `MulmoChatPluginQuiz/`

### Phase 4: Reactデモの実装

1. `react/` ディレクトリを作成
2. View.tsx, Preview.tsx を実装
3. Reactデモアプリを作成

**成果物:**
- `MulmoChatPluginQuiz/src/react/`
- `MulmoChatPluginQuiz/demo/react/`

### Phase 5: 他のプラグインへの展開

1. GenerateImage, Form, SummarizePdf プラグインに同様の変更を適用
2. 内蔵プラグインの外部化を検討

---

## 技術的詳細

### ビルド設定（Vite）

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    react(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.vue"]
    }),
  ],
  build: {
    lib: {
      entry: {
        "core/index": "src/core/index.ts",
        "vue/index": "src/vue/index.ts",
        "react/index": "src/react/index.tsx",
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["vue", "react", "react-dom"],
      output: {
        preserveModules: true,
        exports: "named",
      },
    },
  },
});
```

### CSS: Tailwind CSS

両フレームワークで同じユーティリティクラスを使用。

```tsx
// React
<div className="p-4 bg-white rounded-lg">

// Vue
<div class="p-4 bg-white rounded-lg">
```

**メリット:**
- フレームワーク間で完全に同じクラス名
- ビルド時に未使用クラスが除去される
- ホストアプリのTailwind設定を継承可能

**注意点:**
- プラグインは `@tailwind` ディレクティブを含めない
- ホストアプリがTailwindを設定する責任を持つ
- プラグインの `style.css` は追加のカスタムスタイルのみ

### 状態管理

Viewコンポーネント内のローカル状態はフレームワーク固有のAPIを使用。

```typescript
// Vue
const gameState = ref<GameState>(initialState);
watch(() => props.selectedResult, (newResult) => {
  gameState.value = newResult.jsonData;
});

// React
const [gameState, setGameState] = useState<GameState>(initialState);
useEffect(() => {
  setGameState(props.selectedResult.jsonData);
}, [props.selectedResult]);
```

### ホストアプリとの連携

#### Vue ホストアプリ

```vue
<script setup lang="ts">
import { QuizPlugin } from "@mulmochat-plugin/quiz/vue";

const ViewComponent = computed(() => {
  return getToolPlugin(selectedResult.toolName)?.viewComponent;
});
</script>

<template>
  <component
    :is="ViewComponent"
    :selected-result="selectedResult"
    :send-text-message="sendTextMessage"
    @update-result="handleUpdateResult"
  />
</template>
```

#### React ホストアプリ

```tsx
import { QuizPlugin } from "@mulmochat-plugin/quiz/react";

function ToolView({ selectedResult, sendTextMessage, onUpdateResult }) {
  const plugin = getToolPlugin(selectedResult.toolName);
  const ViewComponent = plugin?.ViewComponent;

  if (!ViewComponent) return null;

  return (
    <ViewComponent
      selectedResult={selectedResult}
      sendTextMessage={sendTextMessage}
      onUpdateResult={onUpdateResult}
    />
  );
}
```

---

## プラグイン設定: JSON Schema仕様

プラグイン固有の設定はJSON Schemaで定義し、ホストアプリがUIを自動生成する。

### 型定義

```typescript
/**
 * プラグイン設定スキーマ
 */
export interface PluginConfigSchema {
  /** ストレージキー（ユニーク） */
  key: string;

  /** デフォルト値 */
  defaultValue: ConfigValue;

  /** UIスキーマ */
  schema: ConfigFieldSchema;
}

/** 設定値の型 */
export type ConfigValue = string | number | boolean | string[];

/**
 * 設定フィールドのスキーマ
 */
export type ConfigFieldSchema =
  | StringFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema
  | SelectFieldSchema
  | MultiSelectFieldSchema;

/** 共通フィールドプロパティ */
interface BaseFieldSchema {
  /** 表示ラベル */
  label: string;

  /** 説明文（オプション） */
  description?: string;

  /** 必須かどうか（デフォルト: true） */
  required?: boolean;
}

/** 文字列入力フィールド */
export interface StringFieldSchema extends BaseFieldSchema {
  type: "string";

  /** プレースホルダー */
  placeholder?: string;

  /** 最小文字数 */
  minLength?: number;

  /** 最大文字数 */
  maxLength?: number;

  /** 正規表現パターン */
  pattern?: string;
}

/** 数値入力フィールド */
export interface NumberFieldSchema extends BaseFieldSchema {
  type: "number";

  /** 最小値 */
  min?: number;

  /** 最大値 */
  max?: number;

  /** ステップ値 */
  step?: number;
}

/** ブール値（チェックボックス）フィールド */
export interface BooleanFieldSchema extends BaseFieldSchema {
  type: "boolean";
}

/** 単一選択フィールド */
export interface SelectFieldSchema extends BaseFieldSchema {
  type: "select";

  /** 選択肢 */
  options: SelectOption[];
}

/** 複数選択フィールド */
export interface MultiSelectFieldSchema extends BaseFieldSchema {
  type: "multiselect";

  /** 選択肢 */
  options: SelectOption[];

  /** 最小選択数 */
  minItems?: number;

  /** 最大選択数 */
  maxItems?: number;
}

/** 選択肢 */
export interface SelectOption {
  /** 値（保存される値） */
  value: string;

  /** 表示ラベル */
  label: string;

  /** 説明（オプション） */
  description?: string;

  /** 無効化（オプション） */
  disabled?: boolean;
}
```

### 使用例

#### 例1: 単一選択（セレクトボックス）

```typescript
// プラグイン定義
export const plugin: ToolPluginCore = {
  // ...
  config: {
    key: "imageStyle",
    defaultValue: "photorealistic",
    schema: {
      type: "select",
      label: "Default Image Style",
      description: "Generated images will use this style by default",
      options: [
        { value: "photorealistic", label: "Photorealistic" },
        { value: "anime", label: "Anime / Illustration" },
        { value: "watercolor", label: "Watercolor" },
        { value: "oil-painting", label: "Oil Painting" },
        { value: "sketch", label: "Pencil Sketch" },
      ],
    },
  },
};
```

#### 例2: 数値入力（スライダー/入力）

```typescript
config: {
  key: "maxQuestions",
  defaultValue: 5,
  schema: {
    type: "number",
    label: "Maximum Questions",
    description: "Maximum number of questions per quiz",
    min: 1,
    max: 20,
    step: 1,
  },
}
```

#### 例3: ブール値（トグル/チェックボックス）

```typescript
config: {
  key: "autoSubmit",
  defaultValue: false,
  schema: {
    type: "boolean",
    label: "Auto Submit",
    description: "Automatically submit when all questions are answered",
  },
}
```

#### 例4: 文字列入力

```typescript
config: {
  key: "apiEndpoint",
  defaultValue: "",
  schema: {
    type: "string",
    label: "Custom API Endpoint",
    description: "Leave empty to use default endpoint",
    placeholder: "https://api.example.com/v1",
    pattern: "^https?://.*",
    required: false,
  },
}
```

#### 例5: 複数選択

```typescript
config: {
  key: "enabledFeatures",
  defaultValue: ["hints", "timer"],
  schema: {
    type: "multiselect",
    label: "Enabled Features",
    description: "Select features to enable",
    options: [
      { value: "hints", label: "Show Hints" },
      { value: "timer", label: "Show Timer" },
      { value: "progress", label: "Show Progress Bar" },
      { value: "shuffle", label: "Shuffle Questions" },
    ],
    minItems: 1,
  },
}
```

### ホストアプリ実装

ホストアプリはスキーマに基づいてUIを自動生成する。

#### Vue実装例

```vue
<!-- components/PluginConfigField.vue -->
<template>
  <!-- String -->
  <div v-if="schema.type === 'string'" class="flex flex-col gap-1">
    <label class="text-sm font-medium">{{ schema.label }}</label>
    <input
      type="text"
      :value="modelValue"
      :placeholder="schema.placeholder"
      :required="schema.required !== false"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="px-3 py-2 border rounded-md"
    />
    <p v-if="schema.description" class="text-xs text-gray-500">
      {{ schema.description }}
    </p>
  </div>

  <!-- Number -->
  <div v-else-if="schema.type === 'number'" class="flex flex-col gap-1">
    <label class="text-sm font-medium">{{ schema.label }}</label>
    <input
      type="number"
      :value="modelValue"
      :min="schema.min"
      :max="schema.max"
      :step="schema.step"
      @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      class="px-3 py-2 border rounded-md"
    />
    <p v-if="schema.description" class="text-xs text-gray-500">
      {{ schema.description }}
    </p>
  </div>

  <!-- Boolean -->
  <label v-else-if="schema.type === 'boolean'" class="flex items-center gap-2">
    <input
      type="checkbox"
      :checked="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="text-sm font-medium">{{ schema.label }}</span>
    <span v-if="schema.description" class="text-xs text-gray-500">
      - {{ schema.description }}
    </span>
  </label>

  <!-- Select -->
  <div v-else-if="schema.type === 'select'" class="flex flex-col gap-1">
    <label class="text-sm font-medium">{{ schema.label }}</label>
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      class="px-3 py-2 border rounded-md"
    >
      <option
        v-for="option in schema.options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <p v-if="schema.description" class="text-xs text-gray-500">
      {{ schema.description }}
    </p>
  </div>

  <!-- MultiSelect -->
  <div v-else-if="schema.type === 'multiselect'" class="flex flex-col gap-1">
    <label class="text-sm font-medium">{{ schema.label }}</label>
    <div class="flex flex-col gap-2">
      <label
        v-for="option in schema.options"
        :key="option.value"
        class="flex items-center gap-2"
      >
        <input
          type="checkbox"
          :checked="(modelValue as string[])?.includes(option.value)"
          :disabled="option.disabled"
          @change="handleMultiSelectChange(option.value, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ option.label }}</span>
      </label>
    </div>
    <p v-if="schema.description" class="text-xs text-gray-500">
      {{ schema.description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { ConfigFieldSchema, ConfigValue } from "gui-chat-protocol";

const props = defineProps<{
  schema: ConfigFieldSchema;
  modelValue: ConfigValue;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ConfigValue];
}>();

function handleMultiSelectChange(value: string, checked: boolean) {
  const current = (props.modelValue as string[]) || [];
  const next = checked
    ? [...current, value]
    : current.filter((v) => v !== value);
  emit("update:modelValue", next);
}
</script>
```

#### React実装例

```tsx
// components/PluginConfigField.tsx
import type { ConfigFieldSchema, ConfigValue } from "gui-chat-protocol";

interface Props {
  schema: ConfigFieldSchema;
  value: ConfigValue;
  onChange: (value: ConfigValue) => void;
}

export function PluginConfigField({ schema, value, onChange }: Props) {
  switch (schema.type) {
    case "string":
      return (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{schema.label}</label>
          <input
            type="text"
            value={value as string}
            placeholder={schema.placeholder}
            required={schema.required !== false}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
        </div>
      );

    case "number":
      return (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{schema.label}</label>
          <input
            type="number"
            value={value as number}
            min={schema.min}
            max={schema.max}
            step={schema.step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          />
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
        </div>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm font-medium">{schema.label}</span>
          {schema.description && (
            <span className="text-xs text-gray-500">- {schema.description}</span>
          )}
        </label>
      );

    case "select":
      return (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{schema.label}</label>
          <select
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            {schema.options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
        </div>
      );

    case "multiselect":
      const selectedValues = (value as string[]) || [];
      return (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{schema.label}</label>
          <div className="flex flex-col gap-2">
            {schema.options.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  disabled={option.disabled}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((v) => v !== option.value);
                    onChange(next);
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
        </div>
      );

    default:
      return null;
  }
}
```

---

## 外部入力ハンドラー: InputHandler仕様

ファイルアップロード以外にも、様々な「外部入力 → ToolResult」パターンがある。
これを汎用的に設計する。

### 現状（fileUploadのみ）

```typescript
// 現状: ファイル専用
interface FileUploadConfig {
  acceptedTypes: string[];
  handleUpload: (fileData: string, fileName: string) => ToolResult;
}
```

### 提案: 汎用InputHandler

```typescript
/**
 * 外部入力ハンドラーの基底型
 */
interface InputHandlerBase {
  /** 入力タイプ識別子 */
  type: string;
}

/**
 * ファイル入力ハンドラー
 */
export interface FileInputHandler extends InputHandlerBase {
  type: "file";

  /** 受け付けるMIMEタイプ */
  acceptedTypes: string[];

  /** ファイルデータをToolResultに変換 */
  handleInput: (fileData: string, fileName: string) => ToolResult;
}

/**
 * クリップボード画像入力ハンドラー
 */
export interface ClipboardImageInputHandler extends InputHandlerBase {
  type: "clipboard-image";

  /** 画像データをToolResultに変換 */
  handleInput: (imageData: string) => ToolResult;
}

/**
 * URL入力ハンドラー
 */
export interface UrlInputHandler extends InputHandlerBase {
  type: "url";

  /** 受け付けるURLパターン（正規表現） */
  patterns?: string[];

  /** URLをToolResultに変換 */
  handleInput: (url: string) => ToolResult;
}

/**
 * テキスト入力ハンドラー
 */
export interface TextInputHandler extends InputHandlerBase {
  type: "text";

  /** 受け付けるテキストパターン（正規表現） */
  patterns?: string[];

  /** テキストをToolResultに変換 */
  handleInput: (text: string) => ToolResult;
}

/**
 * カメラキャプチャ入力ハンドラー
 */
export interface CameraInputHandler extends InputHandlerBase {
  type: "camera";

  /** キャプチャモード */
  mode: "photo" | "video";

  /** キャプチャデータをToolResultに変換 */
  handleInput: (data: string, metadata?: { duration?: number }) => ToolResult;
}

/**
 * 音声入力ハンドラー
 */
export interface AudioInputHandler extends InputHandlerBase {
  type: "audio";

  /** 音声データをToolResultに変換 */
  handleInput: (audioData: string, duration: number) => ToolResult;
}

/**
 * 全InputHandler型のユニオン
 */
export type InputHandler =
  | FileInputHandler
  | ClipboardImageInputHandler
  | UrlInputHandler
  | TextInputHandler
  | CameraInputHandler
  | AudioInputHandler;
```

### プラグインでの使用

```typescript
// ToolPluginCore に追加
export interface ToolPluginCore<T, J, A extends object> {
  // ... 既存フィールド

  /** 外部入力ハンドラー（複数可） */
  inputHandlers?: InputHandler[];
}
```

#### 例1: PDFプラグイン（現行のfileUploadを置き換え）

```typescript
export const plugin: ToolPluginCore = {
  // ...
  inputHandlers: [
    {
      type: "file",
      acceptedTypes: ["application/pdf"],
      handleInput: (fileData, fileName) => ({
        toolName: "summarizePDF",
        data: { pdfData: fileData, fileName },
        message: "",
        title: fileName,
      }),
    },
  ],
};
```

#### 例2: 画像編集プラグイン（複数入力対応）

```typescript
export const plugin: ToolPluginCore = {
  // ...
  inputHandlers: [
    {
      type: "file",
      acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
      handleInput: (fileData, fileName) => ({
        toolName: "editImage",
        data: { imageData: fileData, fileName },
        message: "Image loaded",
      }),
    },
    {
      type: "clipboard-image",
      handleInput: (imageData) => ({
        toolName: "editImage",
        data: { imageData, fileName: "clipboard-image.png" },
        message: "Image pasted from clipboard",
      }),
    },
    {
      type: "camera",
      mode: "photo",
      handleInput: (data) => ({
        toolName: "editImage",
        data: { imageData: data, fileName: "camera-capture.png" },
        message: "Photo captured",
      }),
    },
  ],
};
```

#### 例3: Browseプラグイン（URL入力）

```typescript
export const plugin: ToolPluginCore = {
  // ...
  inputHandlers: [
    {
      type: "url",
      patterns: ["^https?://"],
      handleInput: (url) => ({
        toolName: "browse",
        data: { url },
        message: `Ready to browse: ${url}`,
      }),
    },
  ],
};
```

### ホストアプリ実装

ホストアプリはプラグインの`inputHandlers`を収集し、適切なUIと入力処理を提供する。

```typescript
// ホストアプリのユーティリティ関数
function getAllInputHandlers(plugins: ToolPluginCore[]): Map<string, InputHandler[]> {
  const handlers = new Map<string, InputHandler[]>();

  for (const plugin of plugins) {
    for (const handler of plugin.inputHandlers ?? []) {
      const existing = handlers.get(handler.type) ?? [];
      existing.push(handler);
      handlers.set(handler.type, existing);
    }
  }

  return handlers;
}

// ファイル入力の処理例
function handleFileInput(file: File, handlers: FileInputHandler[]): ToolResult | null {
  const handler = handlers.find(h => h.acceptedTypes.includes(file.type));
  if (!handler) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result as string;
      resolve(handler.handleInput(fileData, file.name));
    };
    reader.readAsDataURL(file);
  });
}

// クリップボードペーストの処理例
async function handlePaste(event: ClipboardEvent, handlers: Map<string, InputHandler[]>) {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    // 画像
    if (item.type.startsWith("image/")) {
      const imageHandlers = handlers.get("clipboard-image") as ClipboardImageInputHandler[];
      if (imageHandlers?.length) {
        const blob = item.getAsFile();
        const imageData = await blobToDataURL(blob);
        return imageHandlers[0].handleInput(imageData);
      }
    }

    // URL
    if (item.type === "text/plain") {
      const text = await new Promise<string>(r => item.getAsString(r));
      const urlHandlers = handlers.get("url") as UrlInputHandler[];
      const urlHandler = urlHandlers?.find(h =>
        !h.patterns || h.patterns.some(p => new RegExp(p).test(text))
      );
      if (urlHandler) {
        return urlHandler.handleInput(text);
      }
    }
  }

  return null;
}
```

### マイグレーション

既存の`fileUpload`から`inputHandlers`への移行：

```typescript
// Before
fileUpload: {
  acceptedTypes: ["application/pdf"],
  handleUpload: createUploadedPdfResult,
}

// After
inputHandlers: [
  {
    type: "file",
    acceptedTypes: ["application/pdf"],
    handleInput: createUploadedPdfResult,
  },
]
```

---

## 提案: 将来の拡張機能

以下はMulmoChatのビジョン（音声/テキストで対話し、ツールを動的に使い、絵・グラフ・プレゼン等を作成）を実現するための拡張提案。実装は未定。

### 現状の課題分析

| 課題 | 現状 | 影響 |
|------|------|------|
| **結果間の参照なし** | 各ToolResultは独立 | 「さっきの画像」を参照できない |
| **単一コンテキスト** | `context.currentResult`は選択中のみ | 複数結果を組み合わせられない |
| **ツール間直接呼び出しなし** | LLM経由でのみチェーン可能 | 複合操作が冗長 |
| **ワークスペース概念なし** | 結果は配列に蓄積されるだけ | プレゼン等のドキュメント構造表現が困難 |
| **ストリーミングなし** | 結果は完成後に一括返却 | 長時間処理の進捗表示困難 |
| **Undo/履歴なし** | 上書き更新のみ | 「元に戻す」ができない |

---

### 提案1: リソース参照システム

ツール結果を他のツールから参照可能にする。

```typescript
interface ToolResultComplete<T, J> extends ToolResult<T, J> {
  uuid: string;  // 既存
  toolName: string;  // 既存

  /** リソースタイプ（他ツールが参照時に使用） */
  resourceType?: "image" | "document" | "chart" | "audio" | "video" | "data";

  /** エクスポート可能な形式 */
  exportFormats?: string[];  // ["png", "svg", "pdf"]

  /** 依存する他の結果のUUID */
  dependsOn?: string[];
}

// ToolContextに履歴アクセスを追加
interface ToolContext {
  currentResult?: ToolResult<unknown> | null;

  /** 全結果へのアクセス */
  results?: {
    getAll: () => ToolResultComplete[];
    getById: (uuid: string) => ToolResultComplete | null;
    getByType: (resourceType: string) => ToolResultComplete[];
    getByToolName: (name: string) => ToolResultComplete[];
  };
}
```

**使用例:**

```typescript
// プレゼンツールが既存の画像・グラフを参照
const createPresentationExecute = async (context, args) => {
  const { elementRefs } = args;  // ["uuid-1", "uuid-2", "uuid-3"]

  const elements = elementRefs.map(uuid => {
    const result = context.results?.getById(uuid);
    if (!result) return null;

    switch (result.resourceType) {
      case "image":
        return { type: "image", data: result.data };
      case "chart":
        return { type: "chart", data: result.data };
      default:
        return null;
    }
  }).filter(Boolean);

  return {
    resourceType: "document",
    dependsOn: elementRefs,  // 依存関係を明示
    data: { slides: elements },
    message: `Created presentation with ${elements.length} elements`,
  };
};
```

**期待される効果:**
- 「さっき作った画像を使って」が可能に
- ツール間のデータ共有が明示的に
- 依存関係の追跡が可能

---

### 提案2: ツール機能宣言（Capabilities）

ツールが何をできるかを宣言し、LLMやホストがより賢く振る舞える。

```typescript
interface ToolCapabilities {
  /** 出力リソースタイプ */
  outputType?: "image" | "document" | "chart" | "audio" | "data";

  /** 入力として受け付けるリソースタイプ */
  acceptsInputTypes?: string[];

  /** ストリーミング対応 */
  streaming?: boolean;

  /** Undo対応 */
  undoable?: boolean;

  /** 他のツール結果を参照可能 */
  canReferenceResults?: boolean;

  /** バッチ処理対応（複数入力を一度に処理） */
  batchable?: boolean;

  /** 長時間実行の可能性 */
  longRunning?: boolean;
}

interface ToolPluginCore<T, J, A extends object> {
  // ... 既存フィールド

  /** ツールの機能宣言 */
  capabilities?: ToolCapabilities;
}
```

**使用例:**

```typescript
export const plugin: ToolPluginCore = {
  toolDefinition: { /* ... */ },
  execute: generateChartExecute,
  generatingMessage: "Generating chart...",

  capabilities: {
    outputType: "chart",
    acceptsInputTypes: ["data"],
    streaming: false,
    undoable: false,
    canReferenceResults: true,
  },
};
```

**期待される効果:**
- LLMがツール選択時に適切な判断可能
- ホストアプリがUIを動的に調整（ストリーミング対応ツールにプログレスバー等）
- ツールのチェーン可能性を自動判定

---

### 提案3: ワークスペース/ドキュメントモデル

複数の結果を構造化して管理する概念。プレゼンテーション、レポート等の複合ドキュメント作成に有用。

```typescript
interface Workspace {
  /** ワークスペースID */
  id: string;

  /** 名前 */
  name: string;

  /** 含まれる要素 */
  elements: WorkspaceElement[];

  /** ワークスペースの種類 */
  type?: "presentation" | "report" | "canvas" | "collection";

  /** メタデータ */
  metadata?: Record<string, unknown>;
}

interface WorkspaceElement {
  /** 要素ID */
  id: string;

  /** 参照するToolResultのUUID */
  resultUuid: string;

  /** ワークスペース内での位置/順序 */
  position?: { x: number; y: number; z?: number };
  order?: number;

  /** 要素固有の設定（サイズ、スタイル等） */
  settings?: Record<string, unknown>;
}

// ToolContextに追加
interface ToolContext {
  // ... 既存

  /** 現在のワークスペース（オプション） */
  workspace?: {
    get: () => Workspace | null;
    create: (name: string, type?: string) => Workspace;
    addElement: (resultUuid: string, settings?: Record<string, unknown>) => WorkspaceElement;
    removeElement: (elementId: string) => void;
    updateElement: (elementId: string, updates: Partial<WorkspaceElement>) => void;
    reorderElements: (elementIds: string[]) => void;
  };
}
```

**使用例: プレゼン作成ワークフロー**

```
1. ユーザー: 「猫の絵を描いて」
   → generateImage実行 → 画像結果（uuid: img-1, resourceType: "image"）

2. ユーザー: 「売上データでグラフ作って」
   → generateChart実行 → グラフ結果（uuid: chart-1, resourceType: "chart"）

3. ユーザー: 「これらでプレゼンにまとめて」
   → LLMが以下を実行:
      workspace.create("Cat Sales Presentation", "presentation")
      workspace.addElement("img-1", { order: 1, title: "Our Cat" })
      workspace.addElement("chart-1", { order: 2, title: "Sales Data" })
   → createPresentation がワークスペースの要素を使用してプレゼン生成
```

**期待される効果:**
- 複合ドキュメントの構造化された作成
- 要素の再配置・編集が容易
- ワークスペース単位での保存・共有

---

### 提案4: ストリーミング実行

長時間処理の進捗をリアルタイムで表示。

```typescript
interface ToolPluginCore<T, J, A extends object> {
  /** 通常の実行 */
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;

  /** ストリーミング実行（オプション） */
  executeStream?: (
    context: ToolContext,
    args: A,
    onProgress: (update: StreamUpdate<T, J>) => void
  ) => Promise<ToolResult<T, J>>;
}

interface StreamUpdate<T, J> {
  /** 進捗率（0-100） */
  progress?: number;

  /** 進捗メッセージ */
  message?: string;

  /** 部分的なデータ（プレビュー等） */
  partialData?: Partial<T>;

  /** 部分的なJSONデータ */
  partialJsonData?: Partial<J>;

  /** 現在のステップ */
  step?: string;

  /** 推定残り時間（秒） */
  estimatedTimeRemaining?: number;
}
```

**使用例:**

```typescript
// 動画生成プラグイン
export const plugin: ToolPluginCore = {
  execute: generateVideoExecute,

  executeStream: async (context, args, onProgress) => {
    onProgress({ progress: 0, step: "Initializing..." });

    // フレーム生成
    for (let i = 0; i < totalFrames; i++) {
      const frame = await generateFrame(i);
      onProgress({
        progress: (i / totalFrames) * 80,
        step: `Generating frame ${i + 1}/${totalFrames}`,
        partialData: { previewFrame: frame },
      });
    }

    // エンコード
    onProgress({ progress: 80, step: "Encoding video..." });
    const video = await encodeVideo(frames);

    onProgress({ progress: 100, step: "Complete" });

    return {
      resourceType: "video",
      data: { video },
      message: "Video generated successfully",
    };
  },

  capabilities: {
    outputType: "video",
    streaming: true,
    longRunning: true,
  },
};
```

**期待される効果:**
- 長時間処理でもユーザーが進捗を把握可能
- 部分的なプレビュー表示
- キャンセル機能の実装基盤

---

### 提案5: Undo/履歴サポート

編集操作の取り消し・やり直し。

```typescript
interface ToolResultWithHistory<T, J> extends ToolResultComplete<T, J> {
  /** 履歴管理 */
  history?: {
    /** 過去の状態スタック */
    undoStack: ToolResult<T, J>[];

    /** 取り消した状態スタック */
    redoStack: ToolResult<T, J>[];

    /** 最大履歴数 */
    maxSize?: number;
  };
}

interface ToolPluginCore<T, J, A extends object> {
  // ... 既存

  /** Undo実行（オプション） */
  onUndo?: (
    context: ToolContext,
    currentResult: ToolResultWithHistory<T, J>
  ) => ToolResult<T, J> | null;

  /** Redo実行（オプション） */
  onRedo?: (
    context: ToolContext,
    currentResult: ToolResultWithHistory<T, J>
  ) => ToolResult<T, J> | null;

  /** 履歴に保存すべきか判定（オプション） */
  shouldSaveToHistory?: (
    oldResult: ToolResult<T, J>,
    newResult: ToolResult<T, J>
  ) => boolean;
}
```

**使用例:**

```typescript
// 画像編集プラグイン
export const plugin: ToolPluginCore = {
  execute: editImageExecute,

  onUndo: (context, currentResult) => {
    const { undoStack } = currentResult.history || { undoStack: [] };
    if (undoStack.length === 0) return null;

    return undoStack[undoStack.length - 1];
  },

  shouldSaveToHistory: (oldResult, newResult) => {
    // データが実際に変更された場合のみ履歴に保存
    return oldResult.data?.imageData !== newResult.data?.imageData;
  },

  capabilities: {
    outputType: "image",
    undoable: true,
  },
};
```

**期待される効果:**
- 「元に戻す」「やり直す」操作が可能
- 編集履歴の可視化
- 誤操作からの復帰

---

### 提案の優先度

| 提案 | 優先度 | 実装複雑度 | 効果 | 備考 |
|------|--------|-----------|------|------|
| **リソース参照** | 高 | 中 | 高 | ツール間連携の基盤 |
| **Capabilities** | 高 | 低 | 中 | 型定義追加のみで効果大 |
| **ワークスペース** | 中 | 高 | 高 | 複合ドキュメント作成に必須 |
| **ストリーミング** | 中 | 中 | 中 | UX向上、長時間処理に有用 |
| **Undo/履歴** | 低 | 高 | 中 | 編集系ツールに有用 |

### 推奨実装順序

**Phase A（基盤）:**
1. `resourceType` と `dependsOn` を ToolResult に追加
2. `context.results` で履歴アクセス追加
3. `capabilities` を ToolPluginCore に追加

**Phase B（拡張）:**
4. ワークスペースモデルの設計・実装
5. ストリーミング対応

**Phase C（高度な機能）:**
6. Undo/履歴サポート

---

## 課題と検討事項

### テスト戦略

- コアロジック: フレームワーク非依存のユニットテスト
- Vueコンポーネント: Vue Test Utils
- Reactコンポーネント: React Testing Library

---

## マイルストーン

| Phase | 内容 | 成果物 |
|-------|------|--------|
| 0 | GUI-Chat-Protocol パッケージ作成 | `gui-chat-protocol` npm パッケージ |
| 1 | MulmoChat本体の型定義更新 | `gui-chat-protocol/vue` を使用 |
| 2 | 内蔵プラグイン統一 | 標準化されたprops |
| 3 | 外部プラグイン移行（Quiz） | `@mulmochat-plugin/quiz` のcore/vue分離 |
| 4 | Reactデモ | `@mulmochat-plugin/quiz/react` + デモアプリ |
| 5 | 他プラグインへの展開 | 全外部プラグインの対応 |

---

## 参考

- [Vue 3 コンポーネント](https://vuejs.org/guide/components/registration.html)
- [React コンポーネント](https://react.dev/learn/your-first-component)
- [Vite ライブラリモード](https://vitejs.dev/guide/build.html#library-mode)
- [package.json exports](https://nodejs.org/api/packages.html#package-entry-points)
