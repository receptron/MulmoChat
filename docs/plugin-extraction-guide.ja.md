# プラグイン独立化ガイド（詳細版）

このドキュメントは、MulmoChat の内部プラグインを独立した npm パッケージとして抽出するための完全なガイドです。Claude Code や開発者がこのドキュメントを読むだけで、プラグインの移行を完璧に実行できることを目指しています。

## 目次

1. [概要と目的](#概要と目的)
2. [独立化可能なプラグインの判定](#独立化可能なプラグインの判定)
3. [移行前の準備](#移行前の準備)
4. [完全な移行手順](#完全な移行手順)
5. [MulmoChat への統合](#mulmochat-への統合)
6. [検証とトラブルシューティング](#検証とトラブルシューティング)
7. [完了チェックリスト](#完了チェックリスト)

---

## 概要と目的

### なぜプラグインを独立化するのか

1. **再利用性**: 他のプロジェクトでも使用可能
2. **独立開発**: プラグイン単体でテスト・開発できる
3. **配布**: npm で公開・配布できる
4. **保守性**: コードベースの分離による保守性向上

### 必要な知識

- TypeScript
- Vue 3 Composition API
- npm パッケージの基本構造
- gui-chat-protocol の型システム

---

## 独立化可能なプラグインの判定

### Step 1: プラグインの依存関係を確認

以下のコマンドで依存関係を確認します：

```bash
# プラグイン本体の依存を確認
grep "^import" src/tools/models/YOUR_PLUGIN.ts

# View コンポーネントの依存を確認
grep "^import" src/tools/views/YOUR_PLUGIN.vue

# Preview コンポーネントの依存を確認
grep "^import" src/tools/previews/YOUR_PLUGIN.vue
```

### Step 2: 依存関係の分類

#### ✅ 独立化可能な依存

| 依存先 | 対応方法 |
|--------|----------|
| `gui-chat-protocol` | そのまま使用 |
| npm パッケージ | `dependencies` に追加 |
| `../logic/xxxLogic` | プラグインに内包 |
| `./xxx-engine/` | プラグインに内包 |
| プラグイン固有の JSON ファイル | プラグインに内包 |

#### ⚠️ 独立化前に対応が必要な場合がある依存

| 依存先 | 対応方法 |
|--------|----------|
| `../../components/Xxx.vue` | 先に npm 化するか、プラグインに内包 |
| `../../utils/xxx` | 共有されている場合は先に npm 化 |
| 他のプラグインとの共有型 | 共有型を npm 化 |

**注意**: サーバー API に依存しているプラグインも独立化可能です。`context` 経由でサーバー API にアクセスできます。

### 現在の独立化可能なプラグイン一覧

`src/tools/memo.md` を参照し、以下を確認：

```bash
# src/components に依存していないか確認
grep -r "../../components" src/tools/models/YOUR_PLUGIN.ts src/tools/views/YOUR_PLUGIN.vue src/tools/previews/YOUR_PLUGIN.vue
```

---

## 移行前の準備

### 1. ソースファイルの特定

移行するプラグインのファイルを特定します：

```bash
# プラグイン名を設定（例: spreadsheet）
PLUGIN_NAME=spreadsheet

# 関連ファイルを確認
ls -la src/tools/models/${PLUGIN_NAME}*
ls -la src/tools/views/${PLUGIN_NAME}*
ls -la src/tools/previews/${PLUGIN_NAME}*
```

### 2. 追加のサブディレクトリの確認

```bash
# サブディレクトリがあるか確認（例: spreadsheet-engine）
ls -la src/tools/models/${PLUGIN_NAME}-*/
```

### 3. npm 依存パッケージの確認

View コンポーネントで使用している npm パッケージを確認：

```bash
grep "^import.*from" src/tools/views/${PLUGIN_NAME}.vue | grep -v "from \"\.\.\/" | grep -v "from \"vue\""
```

---

## 完全な移行手順

### Phase 1: ディレクトリ構造の作成

```bash
# 新しいプラグインディレクトリを作成
PLUGIN_DIR=../GUIChatPlugin$(echo ${PLUGIN_NAME^})  # 最初の文字を大文字に
mkdir -p ${PLUGIN_DIR}/src/{core,vue}
mkdir -p ${PLUGIN_DIR}/demo
mkdir -p ${PLUGIN_DIR}/.github/workflows

# サブディレクトリがある場合
# mkdir -p ${PLUGIN_DIR}/src/engine
```

### Phase 2: package.json の作成

**ファイル: `package.json`**

```json
{
  "name": "@gui-chat-plugin/xxx",
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
  "keywords": ["guichat", "plugin"],
  "license": "MIT"
}
```

**重要**: プラグインが使用する npm パッケージ（例: `xlsx`, `marked` など）を `dependencies` に追加してください。

### Phase 3: 設定ファイルの作成

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
      name: "GUIChatPluginXxx",  // プラグイン名に変更
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
      "@typescript-eslint/no-explicit-any": "off",  // 必要に応じて
      "no-useless-escape": "off",  // 必要に応じて
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
```

### Phase 4: Core ファイルの作成

#### src/core/types.ts

**重要**: gui-chat-protocol の型は再定義せず、プラグイン固有の型のみを定義します。

```typescript
/**
 * Xxx Plugin Types
 *
 * Plugin-specific types only.
 * Common types are imported from gui-chat-protocol.
 */

/** Data stored in result.data (UI 表示用) */
export interface XxxToolData {
  // プラグイン固有のデータ構造
  // 例:
  // items: XxxItem[];
  // title: string;
}

/** Arguments passed to the tool (ツール引数) */
export interface XxxArgs {
  // ツールに渡される引数
  // 例:
  // title: string;
  // content: string;
}

/** JSON data returned in result.jsonData (LLM に返すデータ、オプション) */
export interface XxxJsonData {
  // LLM に返すデータ（必要な場合のみ）
}
```

#### src/core/definition.ts

```typescript
/**
 * Xxx Tool Definition (Schema)
 */

import type { ToolDefinition } from "gui-chat-protocol";

export const TOOL_NAME = "xxxTool";  // 元のツール名と同じにする

export const TOOL_DEFINITION: ToolDefinition = {
  type: "function",
  name: TOOL_NAME,
  description: "Description of what this tool does",
  parameters: {
    type: "object",
    properties: {
      // 元の toolDefinition.parameters.properties をコピー
    },
    required: ["requiredParam"],  // 必須パラメータ
  },
};

// システムプロンプト（LLM への指示）
export const SYSTEM_PROMPT = `Use ${TOOL_NAME} when...`;
```

#### src/core/plugin.ts

```typescript
/**
 * Xxx Plugin Core (Framework-agnostic)
 *
 * Contains the plugin logic without UI components.
 */

import type { ToolPluginCore, ToolContext, ToolResult } from "gui-chat-protocol";
import type { XxxToolData, XxxArgs } from "./types";
import { TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";

// Re-export for convenience
export { TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";

// ============================================================================
// Execute Function
// ============================================================================

export const executeXxx = async (
  _context: ToolContext,
  args: XxxArgs,
): Promise<ToolResult<XxxToolData, never>> => {
  // 元の execute 関数のロジックをコピー
  //
  // 注意: 戻り値の型は必ず ToolResult<XxxToolData, never> を明示

  return {
    message: "Success message",
    title: args.title,
    data: {
      // XxxToolData
    },
    instructions: "Instructions for LLM",
  };
};

// ============================================================================
// Core Plugin (without UI components)
// ============================================================================

export const pluginCore: ToolPluginCore<XxxToolData, never, XxxArgs> = {
  toolDefinition: TOOL_DEFINITION,
  execute: executeXxx,
  generatingMessage: "Processing...",
  waitingMessage: "Optional waiting message",  // オプション
  isEnabled: () => true,  // または (startResponse) => !!startResponse?.hasXxxApiKey
  systemPrompt: SYSTEM_PROMPT,
  // inputHandlers: [],  // ファイル入力ハンドラがある場合
  // samples: [],  // samples.ts からインポートする場合は省略
};
```

**型パラメータの説明:**

```typescript
ToolPluginCore<T, J, A>
//            │  │  └── A: 引数の型 (XxxArgs)
//            │  └───── J: jsonData の型 (never = 使用しない)
//            └──────── T: data の型 (XxxToolData)
```

#### src/core/samples.ts（オプション）

```typescript
/**
 * Xxx Plugin Samples
 */

import type { ToolSample } from "gui-chat-protocol";

export const samples: ToolSample[] = [
  {
    name: "Sample 1",
    args: {
      title: "Example Title",
      // 他の引数
    },
  },
  {
    name: "Sample 2",
    args: {
      // ...
    },
  },
];
```

#### src/core/index.ts

```typescript
/**
 * Xxx Plugin - Core (Framework-agnostic)
 *
 * Import from "@your-scope/guichat-plugin-xxx" or "@your-scope/guichat-plugin-xxx/core"
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

### Phase 5: Vue コンポーネントの作成

#### src/vue/View.vue

元の `src/tools/views/xxx.vue` を以下のように修正してコピー：

**修正点:**
1. `import type { ToolResult } from "gui-chat-protocol";` に変更
2. プラグイン固有の型は `../core/types` からインポート
3. `../models/xxx` からのインポートを `../core/...` に変更

```vue
<template>
  <!-- 元のテンプレートをコピー -->
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
// gui-chat-protocol から ToolResult をインポート
import type { ToolResult } from "gui-chat-protocol";
// プラグイン固有の型は core からインポート
import type { XxxToolData } from "../core/types";
// その他の内部インポートも相対パスを修正
import { someFunction } from "../core/plugin";

const props = defineProps<{
  selectedResult: ToolResult<XxxToolData>;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();

// 元のロジックをコピー
</script>

<style scoped>
/* 元のスタイルをコピー */
</style>
```

#### src/vue/Preview.vue

```vue
<template>
  <!-- 元のテンプレートをコピー -->
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "gui-chat-protocol";
import type { XxxToolData } from "../core/types";

const props = defineProps<{
  result: ToolResult<XxxToolData>;
}>();

// 元のロジックをコピー
</script>
```

#### src/vue/index.ts

```typescript
/**
 * Xxx Plugin - Vue Implementation
 *
 * Import from "@your-scope/guichat-plugin-xxx/vue"
 */

import "../style.css";

import type { ToolPlugin } from "gui-chat-protocol/vue";
import type { XxxToolData, XxxArgs } from "../core/types";
import { pluginCore } from "../core/plugin";
import { samples } from "../core/samples";
import View from "./View.vue";
import Preview from "./Preview.vue";

// Vue Plugin (with components)
export const plugin: ToolPlugin<XxxToolData, never, XxxArgs> = {
  ...pluginCore,
  viewComponent: View,
  previewComponent: Preview,
  samples,
};

// Re-export plugin-specific types
export type { XxxToolData, XxxArgs } from "../core/types";

// Re-export core plugin utilities
export {
  TOOL_NAME,
  TOOL_DEFINITION,
  SYSTEM_PROMPT,
  executeXxx,
  pluginCore,
} from "../core/plugin";

export { samples } from "../core/samples";

// Export components for direct use
export { View, Preview };

// Default export for MulmoChat compatibility
export default { plugin };
```

### Phase 6: エントリポイントとスタイル

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

### Phase 7: デモアプリの作成

#### demo/App.vue

```vue
<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-gray-800 mb-8">{{ pluginName }} Demo</h1>

    <!-- Sample Selector Section -->
    <div class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-gray-600 text-xl mb-4">Sample Data</h2>
      <div v-if="samplesList.length > 0" class="flex flex-wrap gap-2 mb-3">
        <button
          v-for="(sample, index) in samplesList"
          :key="index"
          @click="loadSample(sample)"
          class="py-2 px-4 bg-indigo-100 border border-indigo-200 rounded-md cursor-pointer text-sm text-indigo-700 transition-all hover:bg-indigo-200 hover:border-indigo-300"
        >
          {{ sample.name }}
        </button>
      </div>
    </div>

    <!-- View Component -->
    <div v-if="ViewComponent" class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-gray-600 text-xl mb-4">View Component</h2>
      <div class="border border-gray-200 rounded p-4">
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

    <!-- Current Result Data -->
    <div class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-gray-600 text-xl mb-4">Current Result Data</h2>
      <pre class="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { plugin } from "../src/vue";
import type { ToolResult, ToolSample, ToolPlugin } from "gui-chat-protocol/vue";
import type { XxxToolData } from "../src/core/types";

// Plugin configuration
const currentPlugin = plugin as unknown as ToolPlugin;

// Computed properties from plugin
const pluginName = computed(() => currentPlugin.toolDefinition.name);
const toolName = computed(() => currentPlugin.toolDefinition.name);
const samplesList = computed(() => currentPlugin.samples || []);
const ViewComponent = computed(() => currentPlugin.viewComponent);
const PreviewComponent = computed(() => currentPlugin.previewComponent);

// State
const result = ref<ToolResult<XxxToolData>>({
  toolName: toolName.value,
  uuid: "demo-uuid-123",
  message: "Ready",
  title: "",
  data: undefined,
});

// Actions
const loadSample = (sample: ToolSample) => {
  const args = sample.args as XxxArgs;
  result.value = {
    toolName: toolName.value,
    uuid: `demo-${Date.now()}`,
    message: `Loaded: ${sample.name}`,
    title: args.title || sample.name,
    data: {
      // サンプルデータをロード
    },
  };
};

const handleSendTextMessage = (text?: string) => {
  console.log("sendTextMessage called:", text);
};

const handleUpdate = (updated: ToolResult<XxxToolData>) => {
  result.value = updated;
  console.log("Result updated:", updated);
};

// Load first sample on mount
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
    <!-- Material Icons（使用する場合） -->
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  </head>
  <body class="bg-gray-100 p-8">
    <div id="app"></div>
    <script type="module" src="/demo/main.ts"></script>
  </body>
</html>
```

### Phase 8: サブディレクトリのコピー（該当する場合）

プラグインがロジックディレクトリを持つ場合：

```bash
# 例: spreadsheet-engine をコピー
cp -r src/tools/models/spreadsheet-engine/ ${PLUGIN_DIR}/src/engine/

# テストファイルを削除
rm -rf ${PLUGIN_DIR}/src/engine/__tests__/
rm ${PLUGIN_DIR}/src/engine/**/test-*.ts 2>/dev/null
rm ${PLUGIN_DIR}/src/engine/**/verify_*.ts 2>/dev/null
```

**インポートパスの修正:**

エンジン内のファイルで `../` などの相対パスがある場合は、新しい構造に合わせて修正してください。

### Phase 9: GitHub Actions CI 設定

#### .github/workflows/pull_request.yaml

```yaml
name: Node.js CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  lint_test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [24.x]
    steps:
    - uses: actions/checkout@v4
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'yarn'
    - run: yarn install
    - run: yarn run typecheck
    - run: yarn run lint
    - run: yarn run build
    - name: Update version with timestamp
      run: |
        TIMESTAMP=$(date +%Y%m%d%H%M%S)
        VERSION=$(node -p "require('./package.json').version")
        NEW_VERSION="${VERSION}-${TIMESTAMP}"
        npm version $NEW_VERSION --no-git-tag-version
    - run: npm pack
    - name: Upload artifact
      uses: actions/upload-artifact@v4
      with:
        name: npm-package
        path: "*.tgz"
```

### Phase 10: README.md 作成

npm 公開時に使用する README ファイルを作成します。

**ファイル: `README.md`**

```markdown
# @gui-chat-plugin/xxx

A plugin for [MulmoChat](https://github.com/receptron/MulmoChat) - a multi-modal voice chat application with OpenAI's GPT-4 Realtime API.

## What this plugin does

{プラグインの説明を記載}

## Installation

\`\`\`bash
yarn add @gui-chat-plugin/xxx
\`\`\`

## Usage

### Vue Implementation (for MulmoChat)

\`\`\`typescript
// In src/tools/index.ts
import Plugin from "@gui-chat-plugin/xxx/vue";

const pluginList = [
  // ... other plugins
  Plugin,
];

// In src/main.ts
import "@gui-chat-plugin/xxx/style.css";
\`\`\`

### Core Only (Framework-agnostic)

\`\`\`typescript
import { pluginCore, TOOL_NAME } from "@gui-chat-plugin/xxx";
// or
import pluginCore from "@gui-chat-plugin/xxx";
\`\`\`

## Package Exports

| Export | Description |
|--------|-------------|
| `@gui-chat-plugin/xxx` | Core (framework-agnostic) |
| `@gui-chat-plugin/xxx/vue` | Vue implementation with UI components |
| `@gui-chat-plugin/xxx/style.css` | Tailwind CSS styles |

## Development

\`\`\`bash
# Install dependencies
yarn install

# Start dev server (http://localhost:5173/)
yarn dev

# Build
yarn build

# Type check
yarn typecheck

# Lint
yarn lint
\`\`\`

## License

MIT
```

---

## MulmoChat への統合

### Step 1: package.json に追加

```json
{
  "dependencies": {
    "@gui-chat-plugin/xxx": "file:../GUIChatPluginXxx"
  }
}
```

### Step 2: src/tools/index.ts を更新

```typescript
// 1. 内部プラグインのインポートを削除
// import * as XxxPlugin from "./models/xxx";

// 2. 外部プラグインセクションにインポートを追加
import XxxPlugin from "@gui-chat-plugin/xxx/vue";

// 3. pluginList を更新
const pluginList = [
  // External plugins from npm packages
  QuizPlugin,
  GenerateImagePlugin,
  FormPlugin,
  SummarizePdfPlugin,
  XxxPlugin,  // ← 追加
  // Internal plugins
  // ... (XxxPlugin を削除)
];
```

### Step 3: src/main.ts に CSS インポートを追加

```typescript
import "@gui-chat-plugin/xxx/style.css";
```

### Step 4: 依存関係を更新

```bash
cd ../MulmoChat
rm -rf node_modules yarn.lock
yarn install
```

---

## 検証とトラブルシューティング

### 検証コマンド

```bash
# 新しいプラグインで
cd ../GUIChatPluginXxx
yarn install
yarn typecheck
yarn lint
yarn dev  # デモアプリを確認

# MulmoChat で
cd ../MulmoChat
yarn typecheck
yarn lint
yarn run dev  # 実際に動作を確認
```

### よくあるエラーと解決方法

#### エラー: `Type 'ToolResult<T>' is not assignable to type 'ToolResult<T, never>'`

**原因**: execute 関数の戻り値の型が明示されていない

**解決**:
```typescript
// NG
async (): Promise<ToolResult<XxxToolData>> => {

// OK
async (): Promise<ToolResult<XxxToolData, never>> => {
```

#### エラー: `Definition for rule 'sonarjs/xxx' was not found`

**原因**: MulmoChat からコピーしたファイルに sonarjs の eslint-disable コメントがある

**解決**:
```bash
# コメントを無効化
sed -i '' 's/eslint-disable.*sonarjs/eslint-disable -- sonarjs/g' src/**/*.ts
```

または該当行を手動で削除

#### エラー: `Cannot find module '@your-scope/guichat-plugin-xxx'`

**原因**: yarn install が正しく実行されていない

**解決**:
```bash
rm -rf node_modules yarn.lock
yarn install
```

#### エラー: `'TOOL_NAME' is declared but its value is never read`

**原因**: インポートしたが使用していない

**解決**:
```typescript
// 使用しない場合はインポートから削除
import { TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";  // TOOL_NAME を削除

// Re-export ではそのまま
export { TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";  // これは OK
```

---

## 完了チェックリスト

### 新しいプラグイン

- [ ] `package.json` が正しく設定されている（`@gui-chat-plugin/xxx` 形式）
- [ ] 必要な npm 依存パッケージが `dependencies` に追加されている
- [ ] `.github/workflows/pull_request.yaml` が作成されている
- [ ] `README.md` が作成されている
- [ ] `yarn install` が成功する
- [ ] `yarn typecheck` がエラーなしで完了する
- [ ] `yarn lint` がエラーなしで完了する
- [ ] `yarn dev` でデモアプリが正常に動作する

### MulmoChat

- [ ] `package.json` にプラグインへの参照が追加されている
- [ ] `src/tools/index.ts` でインポートと pluginList が更新されている
- [ ] `yarn install` が成功する
- [ ] `yarn typecheck` がエラーなしで完了する
- [ ] `yarn lint` がエラーなしで完了する
- [ ] `yarn run dev` でプラグインが正常に動作する

---

## 参考: 既存の独立化済みプラグイン

| パッケージ名 | リポジトリ | 備考 |
|------------|-----------|------|
| `@gui-chat-plugin/quiz` | GUIChatPluginQuiz | jsonData を使用 |
| `@gui-chat-plugin/form` | GUIChatPluginForm | フォームプラグイン |
| `@gui-chat-plugin/generate-image` | GUIChatPluginGenerateImage | 画像生成 |
| `@gui-chat-plugin/summarize-pdf` | GUIChatPluginSummarizePdf | inputHandlers 使用 |
| `@gui-chat-plugin/spreadsheet` | GUIChatPluginSpreadsheet | engine サブディレクトリあり |

これらのプラグインのソースコードを参考にしてください。
