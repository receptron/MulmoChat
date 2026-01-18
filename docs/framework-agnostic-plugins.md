# フレームワーク非依存プラグインアーキテクチャ

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

## 外部プラグインの現状構造

### 現在のディレクトリ構成

```
@mulmochat-plugin/quiz/
├── src/
│   ├── common/              ← 共通型定義（MulmoChatからコピー）
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

### 現在の plugin/index.ts

```typescript
// src/plugin/index.ts - 現状
import type { ToolPlugin, ToolContext, ToolResult } from "../common";
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

### 現在の package.json exports

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
  "peerDependencies": {
    "vue": "^3.5.0"  // ← Vue必須
  }
}
```

---

## 提案: 新しいディレクトリ構成

### core/vue/react 分離構造

```
@mulmochat-plugin/quiz/
├── src/
│   ├── common/              ← 共通型定義
│   │   ├── index.ts
│   │   └── types.ts
│   │
│   ├── core/                ← フレームワーク非依存（NEW）
│   │   ├── index.ts         ← コアプラグインエクスポート
│   │   ├── execute.ts       ← execute関数
│   │   ├── tools.ts         ← TOOL_DEFINITION
│   │   ├── types.ts         ← QuizData, QuizArgs
│   │   └── samples.ts       ← テスト用サンプル
│   │
│   ├── vue/                 ← Vueアダプター（NEW）
│   │   ├── index.ts         ← Vueプラグインエクスポート
│   │   ├── View.vue
│   │   └── Preview.vue
│   │
│   ├── react/               ← Reactアダプター（NEW）
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
│   └── react/               ← Reactデモ（NEW）
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
import type { ToolPluginCore } from "../common";
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
import type { ToolPluginVue } from "../common";
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
import type { ToolPluginReact } from "../common";
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
import type { ViewComponentProps } from "../common";
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
import type { PreviewComponentProps } from "../common";
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

```typescript
// 新しい型定義

/**
 * コアプラグイン - フレームワーク非依存
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
  fileUpload?: FileUploadConfig;
  config?: ToolPluginConfig;
  samples?: ToolSample[];
  backends?: BackendType[];
}

/**
 * Vueプラグイン - Vue用アダプター
 */
export interface ToolPluginVue<
  T = unknown,
  J = unknown,
  A extends object = object,
> extends ToolPluginCore<T, J, A> {
  viewComponent?: VueComponent;
  previewComponent?: VueComponent;
}

/**
 * Reactプラグイン - React用アダプター
 */
export interface ToolPluginReact<
  T = unknown,
  J = unknown,
  A extends object = object,
> extends ToolPluginCore<T, J, A> {
  ViewComponent?: React.ComponentType<ViewComponentProps<T, J>>;
  PreviewComponent?: React.ComponentType<PreviewComponentProps<T, J>>;
}
```

### 2. コンポーネントpropsの標準化

フレームワーク間で共通のpropsインターフェースを定義。

```typescript
/**
 * Viewコンポーネントのprops - フレームワーク非依存の定義
 */
export interface ViewComponentProps<T = unknown, J = unknown> {
  /** 選択されたツール結果 */
  selectedResult: ToolResultComplete<T, J>;

  /** テキストメッセージを送信する関数 */
  sendTextMessage: (text?: string) => void;

  /** 結果を更新するコールバック */
  onUpdateResult?: (result: Partial<ToolResult<T, J>>) => void;

  /** プラグイン設定値 */
  pluginConfigs?: Record<string, unknown>;
}

/**
 * Previewコンポーネントのprops
 */
export interface PreviewComponentProps<T = unknown, J = unknown> {
  /** ツール結果 */
  result: ToolResultComplete<T, J>;

  /** 選択されているかどうか */
  isSelected?: boolean;

  /** 選択時のコールバック */
  onSelect?: () => void;
}
```

### 3. パッケージ構造の変更

外部プラグインを以下の構造に変更。

```
@mulmochat-plugin/quiz/
├── src/
│   ├── core/                    ← フレームワーク非依存
│   │   ├── index.ts             ← コアプラグインエクスポート
│   │   ├── types.ts             ← プラグイン固有の型
│   │   ├── execute.ts           ← execute関数
│   │   └── toolDefinition.ts    ← ツール定義
│   │
│   ├── vue/                     ← Vueアダプター
│   │   ├── index.ts             ← Vueプラグインエクスポート
│   │   ├── View.vue
│   │   └── Preview.vue
│   │
│   └── react/                   ← Reactアダプター
│       ├── index.tsx            ← Reactプラグインエクスポート
│       ├── View.tsx
│       └── Preview.tsx
│
├── package.json
└── vite.config.ts
```

#### package.json exports

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
    }
  },
  "peerDependencies": {
    "vue": "^3.5.0"
  },
  "peerDependenciesMeta": {
    "vue": {
      "optional": true
    },
    "react": {
      "optional": true
    }
  }
}
```

#### 使用例

```typescript
// Vueアプリケーション
import QuizPlugin from "@mulmochat-plugin/quiz/vue";

// Reactアプリケーション
import QuizPlugin from "@mulmochat-plugin/quiz/react";

// コアロジックのみ（UIなし）
import { plugin as quizCore } from "@mulmochat-plugin/quiz";
```

---

## 実装計画

### Phase 1: 型定義の整理

1. `ToolPluginCore` インターフェースを定義
2. `ToolPluginVue`, `ToolPluginReact` を定義
3. `ViewComponentProps`, `PreviewComponentProps` を定義
4. `PluginConfigSchema` を定義

**対象ファイル:**
- `src/tools/types.ts`
- `src/common/types.ts`（外部プラグイン用）

### Phase 2: 内蔵プラグインのリファクタリング

1. 内蔵プラグインのViewコンポーネントを標準propsに統一
2. Previewコンポーネントを標準propsに統一

**対象ファイル:**
- `src/tools/views/*.vue`
- `src/tools/previews/*.vue`
- `src/views/HomeView.vue`（props渡し部分）

### Phase 3: Quizプラグインの分離

1. core/ ディレクトリにロジックを移動
2. vue/ ディレクトリにVueコンポーネントを移動
3. ビルド設定を更新
4. package.json の exports を設定

**対象リポジトリ:**
- `MulmoChatPluginQuiz/`

### Phase 4: Reactデモの実装

1. react/ ディレクトリを作成
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
import type { ConfigFieldSchema, ConfigValue } from "@mulmochat/plugin-types";

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
import type { ConfigFieldSchema, ConfigValue } from "@mulmochat/plugin-types";

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

## 課題と検討事項

### テスト戦略

- コアロジック: フレームワーク非依存のユニットテスト
- Vueコンポーネント: Vue Test Utils
- Reactコンポーネント: React Testing Library

---

## マイルストーン

| Phase | 内容 | 成果物 |
|-------|------|--------|
| 1 | 型定義の整理 | `ToolPluginCore`, `ViewComponentProps` |
| 2 | 内蔵プラグイン統一 | 標準化されたprops |
| 3 | Quizプラグイン分離 | `@mulmochat-plugin/quiz` のcore/vue分離 |
| 4 | Reactデモ | `@mulmochat-plugin/quiz/react` + デモアプリ |
| 5 | 他プラグインへの展開 | 全外部プラグインの対応 |

---

## 参考

- [Vue 3 コンポーネント](https://vuejs.org/guide/components/registration.html)
- [React コンポーネント](https://react.dev/learn/your-first-component)
- [Vite ライブラリモード](https://vitejs.dev/guide/build.html#library-mode)
- [package.json exports](https://nodejs.org/api/packages.html#package-entry-points)
