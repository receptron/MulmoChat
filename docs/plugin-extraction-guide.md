# Plugin Extraction Guide (Detailed Version)

This document is a complete guide for extracting MulmoChat's internal plugins as independent npm packages. The goal is to enable Claude Code or developers to perfectly execute plugin migration by reading this document alone.

## Table of Contents

1. [Overview and Purpose](#overview-and-purpose)
2. [Determining Plugin Extractability](#determining-plugin-extractability)
3. [Pre-Migration Preparation](#pre-migration-preparation)
4. [Complete Migration Steps](#complete-migration-steps)
5. [MulmoChat Integration](#mulmochat-integration)
6. [Verification and Troubleshooting](#verification-and-troubleshooting)
7. [Completion Checklist](#completion-checklist)

---

## Overview and Purpose

### Why Extract Plugins

1. **Reusability**: Can be used in other projects
2. **Independent Development**: Can test and develop plugins standalone
3. **Distribution**: Can publish and distribute via npm
4. **Maintainability**: Improved maintainability through codebase separation

### Required Knowledge

- TypeScript
- Vue 3 Composition API
- Basic npm package structure
- gui-chat-protocol type system

---

## Determining Plugin Extractability

### Step 1: Check Plugin Dependencies

Check dependencies with the following commands:

```bash
# Check plugin body dependencies
grep "^import" src/tools/models/YOUR_PLUGIN.ts

# Check View component dependencies
grep "^import" src/tools/views/YOUR_PLUGIN.vue

# Check Preview component dependencies
grep "^import" src/tools/previews/YOUR_PLUGIN.vue

# Check View/Preview external dependencies
grep -rh "import.*from.*\.\./\.\./components\|import.*from.*\.\./\.\./utils" src/tools/views/YOUR_PLUGIN.vue src/tools/previews/YOUR_PLUGIN.vue
```

### Step 2: Classify Dependencies

#### ✅ Extractable Dependencies

| Dependency | Solution |
|------------|----------|
| `gui-chat-protocol` | Use as-is |
| npm packages | Add to `dependencies` |
| `../logic/xxxLogic` | Include in plugin |
| `./xxx-engine/` | Include in plugin |
| Plugin-specific JSON files | Include in plugin |

#### ⚠️ Dependencies That May Require Pre-Extraction Work

| Dependency | Solution |
|------------|----------|
| `../../components/Xxx.vue` | Extract to npm first, or include in plugin |
| `../../utils/xxx` | If shared, extract to npm first |
| Shared types with other plugins | Extract shared types to npm |

**Note**: Plugins that depend on server APIs can also be extracted. Server APIs can be accessed via `context`.

### Current Extractable Plugins List

Refer to `src/tools/memo.md` and verify:

```bash
# Check for dependencies on src/components
grep -r "../../components" src/tools/models/YOUR_PLUGIN.ts src/tools/views/YOUR_PLUGIN.vue src/tools/previews/YOUR_PLUGIN.vue
```

---

## Pre-Migration Preparation

### 1. Identify Source Files

Identify the files for the plugin to migrate:

```bash
# Set plugin name (e.g., spreadsheet)
PLUGIN_NAME=spreadsheet

# Check related files
ls -la src/tools/models/${PLUGIN_NAME}*
ls -la src/tools/views/${PLUGIN_NAME}*
ls -la src/tools/previews/${PLUGIN_NAME}*
```

### 2. Check for Additional Subdirectories

```bash
# Check for subdirectories (e.g., spreadsheet-engine)
ls -la src/tools/models/${PLUGIN_NAME}-*/
```

### 3. Check npm Dependencies

Check npm packages used in View components:

```bash
grep "^import.*from" src/tools/views/${PLUGIN_NAME}.vue | grep -v "from \"\.\.\/" | grep -v "from \"vue\""
```

---

## Complete Migration Steps

### Directory Structure

Create new plugins with the following structure:

```
GUIChatPluginXxx/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vite.config.ts
├── eslint.config.js
├── index.html
├── README.md                      # README for npm publishing
├── .gitignore
├── check-plugin-structure.sh      # File structure check
├── check-mulmochat-integration.sh # MulmoChat integration check
├── refresh-in-mulmochat.sh        # Refresh in MulmoChat
├── .github/
│   └── workflows/
│       └── pull_request.yaml      # CI configuration
├── src/
│   ├── index.ts           # Main entry point (re-exports core)
│   ├── style.css          # Tailwind CSS import
│   ├── core/
│   │   ├── index.ts       # Core exports
│   │   ├── types.ts       # Plugin-specific type definitions
│   │   ├── definition.ts  # Tool definition (schema)
│   │   ├── samples.ts     # Sample data (optional)
│   │   └── plugin.ts      # Core plugin logic
│   └── vue/
│       ├── index.ts       # Vue plugin exports
│       ├── View.vue       # Main view component
│       └── Preview.vue    # Preview component
└── demo/
    ├── App.vue            # Demo app
    └── main.ts            # Demo entry point
```

### Phase 1: Create Directory Structure

```bash
# Create new plugin directory
PLUGIN_DIR=../GUIChatPlugin$(echo ${PLUGIN_NAME^})  # Capitalize first letter
mkdir -p ${PLUGIN_DIR}/src/{core,vue}
mkdir -p ${PLUGIN_DIR}/demo
mkdir -p ${PLUGIN_DIR}/.github/workflows

# If subdirectory exists
# mkdir -p ${PLUGIN_DIR}/src/engine
```

### Phase 1.5: Copy Files from Template Repository (Recommended)

Using MulmoChatPluginQuiz as a template is efficient:

```bash
cd ../GUIChatPluginXxx

# Clone template repository (if not already)
git clone https://github.com/receptron/MulmoChatPluginQuiz.git /tmp/MulmoChatPluginQuiz

# Copy configuration files
cp /tmp/MulmoChatPluginQuiz/tsconfig.json .
cp /tmp/MulmoChatPluginQuiz/tsconfig.build.json .
cp /tmp/MulmoChatPluginQuiz/eslint.config.js .
cp /tmp/MulmoChatPluginQuiz/.gitignore .
cp /tmp/MulmoChatPluginQuiz/index.html .
cp /tmp/MulmoChatPluginQuiz/.github/workflows/pull_request.yaml .github/workflows/
cp /tmp/MulmoChatPluginQuiz/src/style.css src/

# Copy package.json and vite.config.ts, then change plugin name
cp /tmp/MulmoChatPluginQuiz/package.json .
cp /tmp/MulmoChatPluginQuiz/vite.config.ts .

# Change name, description, keywords in package.json
# Change name in vite.config.ts (e.g., GUIChatPluginQuiz → GUIChatPluginXxx)

# Copy README.md and change content
cp /tmp/MulmoChatPluginQuiz/README.md .
# Change plugin name, description, Test Prompts in README.md
```

Or if already cloned locally:

```bash
cp ../MulmoChatPluginQuiz/tsconfig.json .
# ... copy other files similarly
```

### Phase 2: Create package.json

**File: `package.json`**

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
    "gui-chat-protocol": "^0.0.1",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "@typescript-eslint/eslint-plugin": "^8.53.0",
    "@typescript-eslint/parser": "^8.53.0",
    "@vitejs/plugin-vue": "^6.0.3",
    "eslint": "^9.39.2",
    "eslint-plugin-vue": "^10.6.2",
    "globals": "^17.0.0",
    "gui-chat-protocol": "^0.0.2",
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

**Important**: Add npm packages used by the plugin (e.g., `xlsx`, `marked`, etc.) to `dependencies`.

### Phase 3: Create Configuration Files

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
      name: "GUIChatPluginXxx",  // Change to plugin name
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
      "@typescript-eslint/no-explicit-any": "off",  // As needed
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-useless-escape": "off",  // As needed
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
```

### Phase 4: Create Core Files

#### src/core/types.ts

**Important**: Do not redefine gui-chat-protocol types; define only plugin-specific types.

```typescript
/**
 * Xxx Plugin - Type Definitions
 *
 * Plugin-specific types only.
 * Common types are imported from gui-chat-protocol.
 */

/** Data stored in result.data (for UI display) */
export interface XxxToolData {
  // Plugin-specific data structure
  // Example:
  // items: XxxItem[];
  // title: string;
}

/** Arguments passed to the tool */
export interface XxxArgs {
  // Arguments passed to the tool
  // Example:
  // title: string;
  // content: string;
}

/** JSON data returned in result.jsonData (data returned to LLM, optional) */
export interface XxxJsonData {
  // Data returned to LLM (only if needed)
}
```

#### src/core/definition.ts

```typescript
/**
 * Xxx Tool Definition (Schema)
 */

import type { ToolDefinition } from "gui-chat-protocol";

export const TOOL_NAME = "xxxTool";  // Keep same as original tool name

export const TOOL_DEFINITION: ToolDefinition = {
  type: "function",
  name: TOOL_NAME,
  description: "Description of what this tool does",
  parameters: {
    type: "object",
    properties: {
      // Copy original toolDefinition.parameters.properties
    },
    required: ["requiredParam"],  // Required parameters
  },
};

// System prompt (instructions to LLM)
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
  // Copy original execute function logic
  //
  // Note: Always explicitly specify return type as ToolResult<XxxToolData, never>

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
  waitingMessage: "Optional waiting message",  // Optional
  isEnabled: () => true,  // Or (startResponse) => !!startResponse?.hasXxxApiKey
  systemPrompt: SYSTEM_PROMPT,
  // inputHandlers: [],  // If file input handlers exist
  // samples: [],  // Omit if importing from samples.ts
};
```

**Type Parameter Explanation:**

```typescript
ToolPluginCore<T, J, A>
//            │  │  └── A: Argument type (XxxArgs)
//            │  └───── J: jsonData type (never = not used)
//            └──────── T: data type (XxxToolData)
```

#### src/core/samples.ts (Optional)

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
      // Other arguments
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

### Phase 5: Create Vue Components

#### src/vue/View.vue

Copy from original `src/tools/views/xxx.vue` with the following modifications:

**Modifications:**
1. Change to `import type { ToolResult } from "gui-chat-protocol";`
2. Import plugin-specific types from `../core/types`
3. Change imports from `../models/xxx` to `../core/...`

```vue
<template>
  <!-- Copy original template -->
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
// Import ToolResult from gui-chat-protocol
import type { ToolResult } from "gui-chat-protocol";
// Import plugin-specific types from core
import type { XxxToolData } from "../core/types";
// Fix other internal imports to relative paths
import { someFunction } from "../core/plugin";

const props = defineProps<{
  selectedResult: ToolResult<XxxToolData>;
  sendTextMessage?: (text: string) => void;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();

// Copy original logic
</script>

<style scoped>
/* Copy original styles */
</style>
```

**Important Import Rules:**
- Import `ToolResult` from `gui-chat-protocol`
- Import plugin-specific types from `../core/types`

#### src/vue/Preview.vue

```vue
<template>
  <!-- Copy original template -->
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "gui-chat-protocol";
import type { XxxToolData } from "../core/types";

const props = defineProps<{
  result: ToolResult<XxxToolData>;
}>();

// Copy original logic
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

### Phase 6: Entry Point and Styles

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

### Phase 7: Create Demo App

#### demo/App.vue

```vue
<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold text-gray-800 mb-8">{{ pluginName }} Demo</h1>

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
      // Load sample data
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
import "../src/style.css";

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
    <!-- Material Icons (if used) -->
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  </head>
  <body class="bg-gray-100 p-8">
    <div id="app"></div>
    <script type="module" src="/demo/main.ts"></script>
  </body>
</html>
```

### Phase 8: Copy Subdirectories (If Applicable)

If the plugin has logic directories:

```bash
# Example: copy spreadsheet-engine
cp -r src/tools/models/spreadsheet-engine/ ${PLUGIN_DIR}/src/engine/

# Remove test files
rm -rf ${PLUGIN_DIR}/src/engine/__tests__/
rm ${PLUGIN_DIR}/src/engine/**/test-*.ts 2>/dev/null
rm ${PLUGIN_DIR}/src/engine/**/verify_*.ts 2>/dev/null
```

**Fix Import Paths:**

If files in the engine use relative paths like `../`, fix them to match the new structure.

### Phase 9: GitHub Actions CI Configuration

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

### Phase 10: Create README.md

Create a README file for npm publishing.

**File: `README.md`**

```markdown
# @gui-chat-plugin/xxx

A plugin for [MulmoChat](https://github.com/receptron/MulmoChat) - a multi-modal voice chat application with OpenAI's GPT-4 Realtime API.

## What this plugin does

{Describe what the plugin does}

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

### Phase 11: Create Development Scripts

#### check-plugin-structure.sh

```bash
#!/bin/bash
# Plugin Structure Checker
# Usage: ./check-plugin-structure.sh

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_NAME=$(basename "$PLUGIN_DIR")

echo "=== Checking plugin structure: $PLUGIN_NAME ==="
echo ""

# Required files list
REQUIRED_FILES=(
  # Root config files
  ".gitignore"
  "package.json"
  "tsconfig.json"
  "tsconfig.build.json"
  "vite.config.ts"
  "eslint.config.js"
  "index.html"
  "README.md"

  # Dev scripts
  "check-plugin-structure.sh"
  "check-mulmochat-integration.sh"
  "refresh-in-mulmochat.sh"

  # Source entry
  "src/index.ts"
  "src/style.css"

  # Core module
  "src/core/index.ts"
  "src/core/types.ts"
  "src/core/definition.ts"
  "src/core/plugin.ts"
  "src/core/samples.ts"

  # Vue module
  "src/vue/index.ts"
  "src/vue/View.vue"
  "src/vue/Preview.vue"

  # Demo files (for yarn run dev)
  "demo/main.ts"
  "demo/App.vue"
)

MISSING=()
OK=()

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$PLUGIN_DIR/$file" ]; then
    OK+=("$file")
  else
    MISSING+=("$file")
  fi
done

# Print results
echo "OK (${#OK[@]} files):"
for file in "${OK[@]}"; do
  echo "  ✓ $file"
done

echo ""

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "MISSING (${#MISSING[@]} files):"
  for file in "${MISSING[@]}"; do
    echo "  ✗ $file"
  done
  echo ""
  echo "=== FAILED: Missing ${#MISSING[@]} required files ==="
  exit 1
else
  echo "=== PASSED: All required files exist ==="
  exit 0
fi
```

#### check-mulmochat-integration.sh

```bash
#!/bin/bash
# MulmoChat Integration Checker
# Usage: ./check-mulmochat-integration.sh

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_NAME="xxx"  # Change to plugin name
PACKAGE_NAME="@gui-chat-plugin/xxx"  # Change to package name
MULMOCHAT_DIR="$PLUGIN_DIR/../MulmoChat"

echo "=== Checking MulmoChat integration for $PACKAGE_NAME ==="
echo ""

ERRORS=()

# Check 1: package.json dependency
echo "[1/3] Checking package.json dependency..."
if grep -q "\"$PACKAGE_NAME\"" "$MULMOCHAT_DIR/package.json"; then
  echo "  ✓ package.json: dependency exists"
else
  echo "  ✗ package.json: dependency MISSING"
  echo "    Add to MulmoChat/package.json dependencies:"
  echo "    \"$PACKAGE_NAME\": \"file:../GUIChatPluginXxx\","
  ERRORS+=("package.json dependency")
fi

# Check 2: main.ts CSS import
echo ""
echo "[2/3] Checking main.ts CSS import..."
if grep -q "$PACKAGE_NAME/style.css" "$MULMOCHAT_DIR/src/main.ts"; then
  echo "  ✓ main.ts: CSS import exists"
else
  echo "  ✗ main.ts: CSS import MISSING"
  echo "    Add to MulmoChat/src/main.ts:"
  echo "    import \"$PACKAGE_NAME/style.css\";"
  ERRORS+=("main.ts CSS import")
fi

# Check 3: tools/index.ts plugin registration
echo ""
echo "[3/3] Checking tools/index.ts plugin registration..."
if grep -q "XxxPlugin" "$MULMOCHAT_DIR/src/tools/index.ts"; then
  echo "  ✓ tools/index.ts: plugin registered"
else
  echo "  ✗ tools/index.ts: plugin NOT registered"
  echo "    Add to MulmoChat/src/tools/index.ts:"
  echo "    import XxxPlugin from \"$PACKAGE_NAME/vue\";"
  echo "    // Add XxxPlugin to pluginList array"
  ERRORS+=("tools/index.ts registration")
fi

echo ""
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "=== FAILED: ${#ERRORS[@]} integration issue(s) found ==="
  echo ""
  echo "Missing items:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
else
  echo "=== PASSED: MulmoChat integration complete ==="
  exit 0
fi
```

#### refresh-in-mulmochat.sh

```bash
#!/bin/bash
# Refresh plugin in MulmoChat
# Usage: ./refresh-in-mulmochat.sh

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_NAME=$(basename "$PLUGIN_DIR")
MULMOCHAT_DIR="$PLUGIN_DIR/../MulmoChat"
PACKAGE_NAME="@gui-chat-plugin/xxx"  # Change to package name

echo "=== Refreshing $PLUGIN_NAME in MulmoChat ==="

# Step 1: Build plugin
echo ""
echo "[1/3] Building plugin..."
cd "$PLUGIN_DIR"
yarn build
if [ $? -ne 0 ]; then
  echo "ERROR: Build failed"
  exit 1
fi

# Step 2: Remove cached version in MulmoChat
echo ""
echo "[2/3] Clearing cache in MulmoChat..."
rm -rf "$MULMOCHAT_DIR/node_modules/$PACKAGE_NAME"

# Step 3: Reinstall
echo ""
echo "[3/3] Reinstalling in MulmoChat..."
cd "$MULMOCHAT_DIR"
yarn install --check-files

echo ""
echo "=== Done! Restart MulmoChat dev server to see changes ==="
```

---

## MulmoChat Integration

### Step 1: Add to package.json

```json
{
  "dependencies": {
    "@gui-chat-plugin/xxx": "file:../GUIChatPluginXxx"
  }
}
```

### Step 2: Update src/tools/index.ts

```typescript
// 1. Remove internal plugin import
// import * as XxxPlugin from "./models/xxx";

// 2. Add import to external plugins section
import XxxPlugin from "@gui-chat-plugin/xxx/vue";

// 3. Update pluginList
const pluginList = [
  // External plugins from npm packages
  QuizPlugin,
  GenerateImagePlugin,
  FormPlugin,
  SummarizePdfPlugin,
  XxxPlugin,  // ← Add
  // Internal plugins
  // ... (remove XxxPlugin)
];
```

### Step 3: Add CSS Import to src/main.ts

```typescript
import "@gui-chat-plugin/xxx/style.css";
```

### Step 4: Update Dependencies

```bash
cd ../MulmoChat
rm -rf node_modules yarn.lock
yarn install
```

---

## Verification and Troubleshooting

### Verification Commands

```bash
# In new plugin
cd ../GUIChatPluginXxx
yarn install
yarn typecheck
yarn lint
yarn dev  # Check demo app

# In MulmoChat
cd ../MulmoChat
yarn typecheck
yarn lint
yarn run dev  # Verify actual operation
```

### Common Errors and Solutions

#### Error: `Type 'ToolResult<T>' is not assignable to type 'ToolResult<T, never>'`

**Cause**: Execute function return type is not explicitly specified

**Solution**:
```typescript
// NG
async (): Promise<ToolResult<XxxToolData>> => {

// OK
async (): Promise<ToolResult<XxxToolData, never>> => {
```

#### Error: `Definition for rule 'sonarjs/xxx' was not found`

**Cause**: Files copied from MulmoChat contain sonarjs eslint-disable comments

**Solution**:
```bash
# Disable comments
sed -i '' 's/eslint-disable.*sonarjs/eslint-disable -- sonarjs/g' src/**/*.ts
```

Or manually delete the relevant lines

#### Error: `Cannot find module '@your-scope/guichat-plugin-xxx'`

**Cause**: yarn install was not executed correctly

**Solution**:
```bash
rm -rf node_modules yarn.lock
yarn install
```

#### Error: `'TOOL_NAME' is declared but its value is never read`

**Cause**: Imported but not used

**Solution**:
```typescript
// Remove from import if not used
import { TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";  // Remove TOOL_NAME

// Re-export is OK as-is
export { TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT } from "./definition";  // This is OK
```

#### yarn install Not Recognizing New Package

```bash
rm -rf node_modules yarn.lock
yarn install
```

---

## Completion Checklist

### New Plugin

- [ ] `package.json` is correctly configured (`@gui-chat-plugin/xxx` format)
- [ ] Required npm dependency packages added to `dependencies`
- [ ] `.github/workflows/pull_request.yaml` created
- [ ] `README.md` created
- [ ] `check-plugin-structure.sh` created
- [ ] `check-mulmochat-integration.sh` created
- [ ] `refresh-in-mulmochat.sh` created
- [ ] `yarn install` succeeds
- [ ] `yarn typecheck` completes without errors
- [ ] `yarn lint` completes without errors
- [ ] `yarn dev` demo app works correctly

### MulmoChat

- [ ] Plugin reference added to `package.json`
- [ ] CSS import added to `src/main.ts`
- [ ] Import and pluginList updated in `src/tools/index.ts`
- [ ] `yarn install` succeeds
- [ ] `yarn typecheck` completes without errors
- [ ] `yarn lint` completes without errors
- [ ] `yarn run dev` plugin works correctly

---

## Reference: Existing Extracted Plugins

| Package Name | Repository | Notes |
|--------------|------------|-------|
| `@gui-chat-plugin/quiz` | GUIChatPluginQuiz | Uses jsonData |
| `@gui-chat-plugin/form` | GUIChatPluginForm | Form plugin |
| `@gui-chat-plugin/generate-image` | GUIChatPluginGenerateImage | Image generation |
| `@gui-chat-plugin/summarize-pdf` | GUIChatPluginSummarizePdf | Uses inputHandlers |
| `@gui-chat-plugin/spreadsheet` | GUIChatPluginSpreadsheet | Has engine subdirectory |
| `@gui-chat-plugin/scroll-to-anchor` | GUIChatPluginScrollToAnchor | Scroll to anchor |
| `@gui-chat-plugin/set-image-style` | GUIChatPluginSetImageStyle | Image style settings |
| `@gui-chat-plugin/switch-role` | GUIChatPluginSwitchRole | Role switching |
| `@gui-chat-plugin/camera` | GUIChatPluginCamera | Camera plugin |
| `@gui-chat-plugin/canvas` | GUIChatPluginCanvas | Canvas plugin |
| `@gui-chat-plugin/edit-html` | GUIChatPluginEditHtml | HTML editing |
| `@gui-chat-plugin/generate-html` | GUIChatPluginGenerateHtml | HTML generation |
| `@gui-chat-plugin/html` | GUIChatPluginHtml | HTML display |
| `@gui-chat-plugin/othello` | GUIChatPluginOthello | Othello game |
| `@gui-chat-plugin/tictactoe` | GUIChatPluginTicTacToe | Tic-Tac-Toe game |
| `@gui-chat-plugin/go` | GUIChatPluginGo | Go game |

Please reference the source code of these plugins.
