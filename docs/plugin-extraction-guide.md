# プラグイン独立化ガイド

このドキュメントでは、MulmoChat の内部プラグイン (`src/tools/models/`) を独立した npm パッケージとして抽出する手順を説明します。

## 概要

MulmoChat のプラグインは `gui-chat-protocol` パッケージの型定義を使用しています。プラグインを独立化することで：

- 他のプロジェクトでも再利用可能になる
- 独立してテスト・開発できる
- npm で公開・配布できる

## 前提条件

### 独立化可能なプラグインの条件

プラグインが以下の条件を満たす場合、独立化が可能です：

1. **`src/components/` に依存していない** - 共有コンポーネントに依存している場合は、先にそのコンポーネントを npm 化する必要がある
2. **他のプラグインと型を共有していない**（または共有型を npm 化している）

**注意**: サーバー API に依存しているプラグインも独立化可能です。

### 依存関係の確認方法

```bash
# View/Preview の外部依存を確認
grep -rh "import.*from.*\.\./\.\./components\|import.*from.*\.\./\.\./utils" src/tools/views/YOUR_PLUGIN.vue src/tools/previews/YOUR_PLUGIN.vue

# プラグイン本体の依存を確認
grep "^import" src/tools/models/YOUR_PLUGIN.ts
```

## ディレクトリ構造

新しいプラグインは以下の構造で作成します：

```
GUIChatPluginXxx/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vite.config.ts
├── eslint.config.js
├── index.html
├── src/
│   ├── index.ts           # メインエントリポイント（core を再エクスポート）
│   ├── style.css          # Tailwind CSS インポート
│   ├── core/
│   │   ├── index.ts       # Core エクスポート
│   │   ├── types.ts       # プラグイン固有の型定義
│   │   ├── definition.ts  # ツール定義（スキーマ）
│   │   ├── samples.ts     # サンプルデータ（オプション）
│   │   └── plugin.ts      # コアプラグインロジック
│   └── vue/
│       ├── index.ts       # Vue プラグインエクスポート
│       ├── View.vue       # メインビューコンポーネント
│       └── Preview.vue    # プレビューコンポーネント
└── demo/
    ├── App.vue            # デモアプリ
    └── main.ts            # デモエントリポイント
```

## 移行手順

### Step 1: ディレクトリ作成

```bash
mkdir -p ../GUIChatPluginXxx/src/{core,vue} ../GUIChatPluginXxx/demo
```

### Step 2: package.json 作成

```json
{
  "name": "@your-scope/guichat-plugin-xxx",
  "version": "0.1.0",
  "description": "Xxx plugin for GUIChat",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./core": {
      "types": "./dist/core/index.d.ts",
      "import": "./dist/core.js",
      "require": "./dist/core.cjs"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue.js",
      "require": "./dist/vue.cjs"
    },
    "./style.css": "./dist/style.css"
  },
  "files": ["dist"],
  "scripts": {
    "dev": "vite",
    "build": "vite build && vue-tsc -p tsconfig.build.json --emitDeclarationOnly",
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint src demo"
  },
  "peerDependencies": {
    "vue": "^3.5.0"
  },
  "dependencies": {
    "gui-chat-protocol": "^0.0.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "@typescript-eslint/eslint-plugin": "^8.53.0",
    "@typescript-eslint/parser": "^8.53.0",
    "@vitejs/plugin-vue": "^6.0.3",
    "eslint": "^9.39.2",
    "eslint-plugin-vue": "^10.6.2",
    "globals": "^17.0.0",
    "tailwindcss": "^4.1.18",
    "typescript": "~5.9.3",
    "vite": "^7.3.1",
    "vue": "^3.5.26",
    "vue-eslint-parser": "^10.2.0",
    "vue-tsc": "^3.2.2"
  },
  "keywords": ["guichat", "plugin", "xxx"],
  "license": "MIT"
}
```

**注意**: プラグインが追加の npm パッケージを使用する場合は `dependencies` に追加してください。

### Step 3: 設定ファイル作成

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "emitDeclarationOnly": true,
    "declaration": true,
    "declarationDir": "./dist",
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "demo/**/*.ts", "demo/**/*.vue"],
  "exclude": ["node_modules", "dist"]
}
```

#### tsconfig.build.json

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "exclude": ["node_modules", "dist", "demo"]
}
```

#### vite.config.ts

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        core: resolve(__dirname, "src/core/index.ts"),
        vue: resolve(__dirname, "src/vue/index.ts"),
      },
      name: "GUIChatPluginXxx",
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        exports: "named",
        globals: {
          vue: "Vue",
        },
        assetFileNames: "style.[ext]",
      },
    },
    cssCodeSplit: false,
  },
});
```

#### eslint.config.js

```javascript
import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import vuePlugin from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import globals from "globals";

export default [
  eslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      vue: vuePlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...vuePlugin.configs["flat/recommended"].rules,
      "vue/multi-word-component-names": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
```

### Step 4: Core ファイル作成

#### src/core/types.ts

プラグイン固有の型のみを定義します。**gui-chat-protocol の型は再定義しません。**

```typescript
/**
 * Xxx Plugin Types
 *
 * Plugin-specific types only.
 * Common types are imported from gui-chat-protocol.
 */

/** Data stored in result.data (displayed in UI) */
export interface XxxToolData {
  // プラグイン固有のデータ
}

/** Arguments passed to the tool */
export interface XxxArgs {
  // ツールに渡される引数
}

/** JSON data returned in result.jsonData (sent to LLM) */
export interface XxxJsonData {
  // LLM に返すデータ（オプション）
}
```

#### src/core/definition.ts

```typescript
/**
 * Xxx Tool Definition (Schema)
 */

import type { ToolDefinition } from "gui-chat-protocol";

export const TOOL_NAME = "xxxTool";

export const TOOL_DEFINITION: ToolDefinition = {
  type: "function",
  name: TOOL_NAME,
  description: "Description of what this tool does",
  parameters: {
    type: "object",
    properties: {
      // パラメータ定義
    },
    required: ["requiredParam"],
  },
};

export const SYSTEM_PROMPT = `Instructions for LLM on how to use ${TOOL_NAME}...`;
```

#### src/core/plugin.ts

```typescript
/**
 * Xxx Plugin Core (Framework-agnostic)
 */

import type { ToolPluginCore, ToolContext, ToolResult } from "gui-chat-protocol";
import type { XxxToolData, XxxArgs } from "./types";
import { TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";

// Re-export for convenience
export { TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";

// Execute Function
export const executeXxx = async (
  _context: ToolContext,
  args: XxxArgs,
): Promise<ToolResult<XxxToolData, never>> => {
  // プラグインのロジック
  return {
    message: "Success message",
    title: args.title,
    data: { /* XxxToolData */ },
    instructions: "Instructions for LLM after execution",
  };
};

// Core Plugin (without UI components)
export const pluginCore: ToolPluginCore<XxxToolData, never, XxxArgs> = {
  toolDefinition: TOOL_DEFINITION,
  execute: executeXxx,
  generatingMessage: "Processing...",
  isEnabled: () => true,
  systemPrompt: SYSTEM_PROMPT,
};
```

**型パラメータの説明:**
- `T` (第1引数): `result.data` に格納される UI 用データ型
- `J` (第2引数): `result.jsonData` に格納される LLM に返すデータ型（不要な場合は `never`）
- `A` (第3引数): ツールに渡される引数の型

#### src/core/samples.ts（オプション）

```typescript
import type { ToolSample } from "gui-chat-protocol";

export const samples: ToolSample[] = [
  {
    name: "Sample 1",
    args: {
      // サンプル引数
    },
  },
];
```

#### src/core/index.ts

```typescript
/**
 * Xxx Plugin - Core (Framework-agnostic)
 */

// Export plugin-specific types
export type { XxxToolData, XxxArgs } from "./types";

// Export plugin utilities
export {
  TOOL_NAME,
  TOOL_DEFINITION,
  SYSTEM_PROMPT,
  executeXxx,
  pluginCore,
} from "./plugin";

// Export samples (if exists)
export { samples } from "./samples";
```

### Step 5: Vue ファイル作成

#### src/vue/View.vue

```vue
<template>
  <div class="xxx-container">
    <!-- メインコンテンツ -->
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "gui-chat-protocol";
import type { XxxToolData } from "../core/types";

const props = defineProps<{
  selectedResult: ToolResult<XxxToolData>;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();

// コンポーネントロジック
</script>

<style scoped>
/* スタイル */
</style>
```

**重要なインポートルール:**
- `ToolResult` は `gui-chat-protocol` からインポート
- プラグイン固有の型は `../core/types` からインポート

#### src/vue/Preview.vue

```vue
<template>
  <div class="xxx-preview">
    <!-- プレビューコンテンツ -->
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "gui-chat-protocol";
import type { XxxToolData } from "../core/types";

const props = defineProps<{
  result: ToolResult<XxxToolData>;
}>();
</script>
```

#### src/vue/index.ts

```typescript
/**
 * Xxx Plugin - Vue Implementation
 */

import "../style.css";

import type { ToolPlugin } from "gui-chat-protocol/vue";
import type { XxxToolData, XxxArgs } from "../core/types";
import { pluginCore } from "../core/plugin";
import { samples } from "../core/samples";
import View from "./View.vue";
import Preview from "./Preview.vue";

export const plugin: ToolPlugin<XxxToolData, never, XxxArgs> = {
  ...pluginCore,
  viewComponent: View,
  previewComponent: Preview,
  samples,
};

// Re-export types
export type { XxxToolData, XxxArgs } from "../core/types";

// Re-export utilities
export {
  TOOL_NAME,
  TOOL_DEFINITION,
  SYSTEM_PROMPT,
  executeXxx,
  pluginCore,
} from "../core/plugin";

export { samples } from "../core/samples";

export { View, Preview };

// Default export for MulmoChat compatibility
export default { plugin };
```

### Step 6: メインエントリポイント

#### src/index.ts

```typescript
/**
 * Xxx Plugin
 *
 * Main entry point - re-exports core module.
 */

export * from "./core";
```

#### src/style.css

```css
@import "tailwindcss";
```

### Step 7: デモアプリ

#### demo/App.vue

```vue
<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-gray-800 mb-8">{{ pluginName }} Demo</h1>

    <!-- Sample Selector -->
    <div class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-gray-600 text-xl mb-4">Samples</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(sample, index) in samplesList"
          :key="index"
          @click="loadSample(sample)"
          class="py-2 px-4 bg-indigo-100 border border-indigo-200 rounded-md cursor-pointer text-sm text-indigo-700 hover:bg-indigo-200"
        >
          {{ sample.name }}
        </button>
      </div>
    </div>

    <!-- View Component -->
    <div v-if="ViewComponent" class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-gray-600 text-xl mb-4">View Component</h2>
      <div class="border border-gray-200 rounded">
        <component
          :is="ViewComponent"
          :selectedResult="result"
          :sendTextMessage="handleSendTextMessage"
          @updateResult="handleUpdate"
        />
      </div>
    </div>

    <!-- Preview Component -->
    <div v-if="PreviewComponent" class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-gray-600 text-xl mb-4">Preview Component</h2>
      <div class="max-w-[200px]">
        <component :is="PreviewComponent" :result="result" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { plugin } from "../src/vue";
import type { ToolResult, ToolSample, ToolPlugin } from "gui-chat-protocol/vue";
import type { XxxToolData } from "../src/core/types";

const currentPlugin = plugin as unknown as ToolPlugin;

const pluginName = computed(() => currentPlugin.toolDefinition.name);
const samplesList = computed(() => currentPlugin.samples || []);
const ViewComponent = computed(() => currentPlugin.viewComponent);
const PreviewComponent = computed(() => currentPlugin.previewComponent);

const result = ref<ToolResult<XxxToolData>>({
  toolName: pluginName.value,
  uuid: "demo-uuid",
  message: "Ready",
  title: "",
  data: undefined,
});

const loadSample = (sample: ToolSample) => {
  // サンプルをロード
};

const handleSendTextMessage = (text?: string) => {
  console.log("sendTextMessage:", text);
};

const handleUpdate = (updated: ToolResult<XxxToolData>) => {
  result.value = updated;
};

onMounted(() => {
  if (samplesList.value.length > 0) {
    loadSample(samplesList.value[0]);
  }
});
</script>
```

#### demo/main.ts

```typescript
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

#### index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Xxx Plugin Demo</title>
  </head>
  <body class="bg-gray-100 p-8">
    <div id="app"></div>
    <script type="module" src="/demo/main.ts"></script>
  </body>
</html>
```

### Step 8: 検証

```bash
cd ../GUIChatPluginXxx
yarn install
yarn typecheck
yarn lint
```

### Step 9: MulmoChat への統合

#### package.json に追加

```json
{
  "dependencies": {
    "@your-scope/guichat-plugin-xxx": "file:../GUIChatPluginXxx"
  }
}
```

#### src/tools/index.ts を更新

```typescript
// 内部プラグインのインポートを削除
// import * as XxxPlugin from "./models/xxx";

// 外部プラグインとしてインポート
import XxxPlugin from "@your-scope/guichat-plugin-xxx/vue";

const pluginList = [
  // External plugins from npm packages
  XxxPlugin,
  // ... other plugins
];
```

#### 依存関係を更新

```bash
cd ../MulmoChat
rm -rf node_modules yarn.lock
yarn install
yarn typecheck
yarn lint
```

## 追加のサブディレクトリがある場合

プラグインが追加のロジックディレクトリを持つ場合（例: `spreadsheet-engine/`）：

1. ディレクトリを `src/` 内にコピー
2. テストファイル（`__tests__/`, `test-*.ts`）は除外
3. インポートパスを相対パスに更新

```bash
# 例: spreadsheet-engine をコピー
cp -r src/tools/models/spreadsheet-engine ../GUIChatPluginSpreadsheet/src/engine

# テストファイルを削除
rm -rf ../GUIChatPluginSpreadsheet/src/engine/__tests__
rm ../GUIChatPluginSpreadsheet/src/engine/functions/test-*.ts
```

## トラブルシューティング

### 型エラー: `ToolResult<T>` が `ToolResult<T, never>` に割り当てられない

execute 関数の戻り値の型を明示的に指定してください：

```typescript
// NG
Promise<ToolResult<XxxToolData>>

// OK
Promise<ToolResult<XxxToolData, never>>
```

### ESLint エラー: Definition for rule 'sonarjs/xxx' was not found

MulmoChat から コピーしたファイルに `eslint-disable` コメントが含まれている場合、削除またはコメントアウトしてください：

```bash
# sonarjs の eslint-disable コメントを無効化
sed -i '' 's/eslint-disable.*sonarjs/eslint-disable -- sonarjs/g' src/**/*.ts
```

### yarn install が新しいパッケージを認識しない

```bash
rm -rf node_modules yarn.lock
yarn install
```

## 完了チェックリスト

- [ ] `yarn typecheck` がエラーなしで完了
- [ ] `yarn lint` がエラーなしで完了
- [ ] `yarn dev` でデモアプリが正常に動作
- [ ] MulmoChat で `yarn typecheck` がエラーなしで完了
- [ ] MulmoChat で `yarn lint` がエラーなしで完了
- [ ] MulmoChat で `yarn run dev` でプラグインが正常に動作

## 参考: 既存の独立化済みプラグイン

- `@mulmochat-plugin/quiz` - Quiz プラグイン
- `@mulmochat-plugin/form` - Form プラグイン
- `@mulmochat-plugin/generate-image` - GenerateImage プラグイン
- `@mulmochat-plugin/summarize-pdf` - SummarizePdf プラグイン
- `@anthropic/guichat-plugin-spreadsheet` - Spreadsheet プラグイン
