# GUIChat Plugin Development Guide

This document provides a complete guide for developing new plugins for GUIChat/MulmoChat. The goal is to enable both humans and AI to implement plugins in one shot.

## Scope of This Guide

### What This Guide Provides

- **Plugin Structure**: Directory layout, file naming conventions, export patterns
- **Type Definition Patterns**: How to use ToolPluginCore, ToolResult, ToolContext
- **Vue Components**: Props and basic structure of View/Preview components
- **Build Configuration**: How to configure package.json, vite.config.ts, tsconfig.json
- **Integration Patterns**: How to use context API, backends, isEnabled

### What Developers Must Provide

- **Feature Specification**: What the plugin does (parameters, behavior, output)
- **Domain Logic**: Game rules, calculation algorithms, data transformations, etc.
- **UI Requirements**: Content to display, interactions, design

This guide teaches "how to build a plugin" but "what to build" must come from your requirements.

## Table of Contents

1. [What is gui-chat-protocol](#what-is-gui-chat-protocol)
2. [Plugin Architecture](#plugin-architecture)
3. [Directory Structure](#directory-structure)
4. [Development Steps](#development-steps)
5. [Testing with samples](#testing-with-samples)
6. [Implementation Example: Othello Plugin](#implementation-example-othello-plugin)
7. [How to Use the context API](#how-to-use-the-context-api)
8. [Reference Plugin List](#reference-plugin-list)
9. [Completion Checklist](#completion-checklist)
10. [AI Instruction Template](#ai-instruction-template)

---

## What is gui-chat-protocol

### Overview

`gui-chat-protocol` is a TypeScript library that defines the standard protocol for GUIChat plugins. It provides framework-agnostic core types and Vue/React adapters.

```bash
npm install gui-chat-protocol
```

### Package Exports

```typescript
// Core types (framework-agnostic)
import { ToolPluginCore, ToolResult, ToolContext, ToolDefinition } from "gui-chat-protocol";

// Vue types
import { ToolPlugin } from "gui-chat-protocol/vue";

// React types
import { ToolPluginReact } from "gui-chat-protocol/react";
```

### Key Types

| Type | Description |
|------|-------------|
| `ToolPluginCore<T, J, A>` | Framework-agnostic plugin definition |
| `ToolPlugin<T, J, A>` | Vue plugin (includes viewComponent, previewComponent) |
| `ToolResult<T, J>` | Return value of execute function |
| `ToolContext` | Context passed to execute function |
| `ToolDefinition` | OpenAI-compatible tool definition schema |
| `ToolSample` | Sample arguments for testing |

### ToolPluginCore Structure

```typescript
interface ToolPluginCore<T, J, A, H, S> {
  toolDefinition: ToolDefinition;    // Tool definition for LLM
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;          // Message displayed during processing
  waitingMessage?: string;            // Message sent to LLM before result display
  isEnabled: (startResponse?: S) => boolean;  // Whether plugin is enabled
  systemPrompt?: string;              // Additional instructions for LLM
  samples?: ToolSample[];             // Samples for testing
  backends?: BackendType[];           // Backends to use
  inputHandlers?: InputHandler[];     // File/clipboard input handlers
}
```

### Backend Types

| Backend | Description | Usage Examples |
|---------|-------------|----------------|
| `"imageGen"` | Image generation API | GenerateImage, EditImage |
| `"textLLM"` | Text generation LLM | GenerateHtml, EditHtml |

```typescript
// Example: Image generation plugin
backends: ["imageGen"],

// Example: HTML generation plugin
backends: ["textLLM"],
```

### inputHandlers (File Input Handlers)

Used when plugins accept file uploads or clipboard input.

```typescript
interface InputHandler {
  type: "file" | "clipboard-image";
  acceptedTypes?: string[];  // MIME types (for file type)
  handleInput: (data: string, fileName?: string) => ToolResult<T>;
}
```

**Usage Example (Image Plugin):**

```typescript
// src/core/plugin.ts
import type { ToolResult } from "gui-chat-protocol";
import type { ImageToolData } from "./types";

// Helper function: Create ToolResult from uploaded image
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
  // ...other properties
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

### ToolResult Structure

```typescript
interface ToolResult<T, J> {
  message: string;              // Status message for LLM (required)
  data?: T;                     // Data for View/Preview (not sent to LLM)
  jsonData?: J;                 // JSON data returned to LLM
  title?: string;               // Title of the result
  instructions?: string;        // Additional instructions for LLM
  instructionsRequired?: boolean; // Whether to always send instructions
  updating?: boolean;           // Whether to update existing result (true = don't create new)
  viewState?: Record<string, unknown>; // View state
}
```

### Type Parameter Explanation

```typescript
ToolPlugin<T, J, A>
```

| Parameter | Description | Example |
|-----------|-------------|---------|
| `T` | Type of `result.data` (for UI, not sent to LLM) | `OthelloState` |
| `J` | Type of `result.jsonData` (sent to LLM) | `{ success: boolean }` |
| `A` | Type of execute function arguments | `{ action: string; row?: number }` |

---

## Plugin Architecture

### Operation Flow

```
User Input → LLM → Tool Call → execute() → ToolResult → View/Preview
     ↑                                                        │
     └──────────── Instruct LLM via instructions ←────────────┘
```

### Difference Between View and Preview

```
┌─────────────────────────────────────────────────────┐
│                    MulmoChat UI                      │
├──────────────┬──────────────────────────────────────┤
│   Sidebar    │              Canvas                   │
│              │                                       │
│ ┌──────────┐ │   ┌─────────────────────────────┐    │
│ │ Preview  │ │   │                             │    │
│ │ Thumbnail│◄──┤         View                │    │
│ └──────────┘ │   │      Main Display           │    │
│ ┌──────────┐ │   │   Interactive Operations    │    │
│ │ Preview  │ │   │                             │    │
│ └──────────┘ │   └─────────────────────────────┘    │
└──────────────┴──────────────────────────────────────┘
```

| Component | Role | Props |
|-----------|------|-------|
| **Preview** | Small thumbnail displayed in sidebar | `result: ToolResult` |
| **View** | Full-size UI displayed on canvas | `selectedResult: ToolResult`, `sendTextMessage: Function` |

---

## Directory Structure

```
GUIChatPluginXxx/
├── package.json              # npm package configuration
├── tsconfig.json             # TypeScript configuration
├── tsconfig.build.json       # Build TypeScript configuration
├── vite.config.ts            # Vite build configuration
├── eslint.config.js          # ESLint configuration
├── index.html                # Demo HTML
├── README.md                 # README for npm publishing
├── .gitignore
├── .github/
│   └── workflows/
│       └── pull_request.yaml # CI configuration
├── src/
│   ├── index.ts              # Main entry (re-exports core)
│   ├── style.css             # Tailwind CSS import
│   ├── core/                 # Framework-agnostic core
│   │   ├── index.ts          # Core exports
│   │   ├── types.ts          # Plugin-specific type definitions
│   │   ├── definition.ts     # Tool definition (TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT)
│   │   ├── plugin.ts         # execute function and pluginCore
│   │   ├── samples.ts        # Test samples (optional)
│   │   └── logic.ts          # Business logic (optional)
│   └── vue/
│       ├── index.ts          # Vue plugin exports
│       ├── View.vue          # Main view component
│       └── Preview.vue       # Preview component
└── demo/
    ├── App.vue               # Demo app (testing with samples)
    └── main.ts               # Demo entry point
```

---

## Tailwind CSS Guidelines

### Important: No Arbitrary Values

**Do NOT use Tailwind's arbitrary values (JIT syntax) in plugin code.**

MulmoChat uses Tailwind's `@source` directive to scan plugin dist files for Tailwind classes. This means only standard Tailwind classes are supported - arbitrary values like `bg-[#1a1a2e]` or `w-[137px]` will NOT work because they require build-time scanning.

```html
<!-- ✅ Good: Standard Tailwind classes -->
<div class="bg-slate-900 w-48 p-4">

<!-- ❌ Bad: Arbitrary values - will NOT work -->
<div class="bg-[#1a1a2e] w-[137px] p-[10px]">
```

### Why This Matters

```
Plugin built separately → dist/vue.js
                              ↓
MulmoChat @source scans → finds "bg-slate-900" → generates CSS ✓
                              ↓
                        → finds "bg-[#1a1a2e]" → NOT generated ✗
```

Tailwind needs to see arbitrary values at build time to generate the corresponding CSS. Since plugins are built separately and then scanned by MulmoChat's `@source` directive, arbitrary values in the scanned files don't trigger CSS generation.

### Alternatives

If you need custom colors or sizes:

1. **Use closest standard Tailwind values**
   - Instead of `bg-[#1a1a2e]`, use `bg-slate-900` or `bg-gray-900`

2. **Define custom styles in your plugin's style.css**
   ```css
   /* src/style.css */
   @import "tailwindcss";

   .my-custom-bg {
     background-color: #1a1a2e;
   }
   ```

3. **Use inline styles for truly dynamic values**
   ```vue
   <div :style="{ backgroundColor: dynamicColor }">
   ```

---

## Development Steps

### Step 1: Create Project from Template

```bash
# Create directories
mkdir -p ../GUIChatPluginXxx/src/{core,vue} ../GUIChatPluginXxx/demo ../GUIChatPluginXxx/.github/workflows
cd ../GUIChatPluginXxx

# Copy files from template (MulmoChatPluginQuiz recommended)
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

### Step 2: Edit Configuration Files

**package.json:**
```json
{
  "name": "@gui-chat-plugin/xxx",
  "description": "Plugin description",
  "keywords": ["guichat", "plugin", "xxx"]
}
```

**vite.config.ts:**
```typescript
name: "GUIChatPluginXxx",
```

### Step 3: Create Core Files

#### src/core/types.ts
```typescript
/** UI data type (used in View/Preview) */
export interface XxxToolData {
  content: string;
}

/** Execute function argument type */
export interface XxxArgs {
  prompt: string;
}

/** Data type returned to LLM (optional) */
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
  description: "Tool description. Clearly describe when LLM should use this tool",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Parameter description",
      },
    },
    required: ["prompt"],
  },
};

export const SYSTEM_PROMPT = `Additional instructions for using ${TOOL_NAME}...`;
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

### Step 4: Create Vue Files

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

### Step 5: Build and Verify

```bash
yarn install
yarn typecheck
yarn lint
yarn build
```

---

## Testing with samples

### What are samples

`samples` are sample arguments for testing plugins standalone. You can call the execute function directly in the demo app to test.

```typescript
// src/core/samples.ts
export const samples: ToolSample[] = [
  {
    name: "New Game (User First)",  // Name displayed on button
    args: {                          // Arguments passed to execute
      action: "new_game",
      firstPlayer: "user",
    },
  },
];
```

### Demo App Implementation

```vue
<!-- demo/App.vue -->
<template>
  <div class="max-w-3xl mx-auto p-8">
    <h1 class="text-2xl font-bold mb-8">{{ pluginName }} Demo</h1>

    <!-- Sample Buttons -->
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

    <!-- View Component -->
    <div v-if="ViewComponent" class="bg-white rounded-lg p-5 mb-5 shadow-md">
      <h2 class="text-xl mb-4">View Component</h2>
      <component
        :is="ViewComponent"
        :selectedResult="result"
        :sendTextMessage="handleSendMessage"
      />
    </div>

    <!-- Preview Component -->
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

### Running Tests

```bash
yarn dev  # Demo starts at http://localhost:5173
```

---

## Implementation Example: Othello Plugin

The Othello plugin is a good example of implementing an interactive game.

**Reference:** [GUIChatPluginOthello](https://github.com/nicedoc/GUIChatPluginOthello)

### Type Definitions (types.ts)

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

### Execute Function (plugin.ts)

```typescript
export const executeOthello = async (
  _context: ToolContext,
  args: OthelloArgs,
): Promise<ToolResult<never, OthelloState>> => {
  const state = playOthello(args);  // Game logic

  const isComputerTurn = state.playerNames[state.currentSide] === "computer";

  const instructions = state.isTerminal
    ? "The game is over. Announce the result."
    : isComputerTurn
      ? "It is your turn. Choose your next move."
      : "Tell the user to make a move.";

  return {
    message: `Played at (${args.row}, ${args.col})`,
    jsonData: state,  // Return board state to LLM
    instructions,
    instructionsRequired: isComputerTurn,  // Always send instructions on computer turn
    updating: args.action !== "new_game",  // Update existing result except for new_game
  };
};
```

### View Component Key Points

```vue
<script setup>
// Use sendTextMessage to communicate user actions to LLM
const handleCellClick = (row, col) => {
  const clickData = { row, col, currentState: gameState.value };
  props.sendTextMessage(
    `I want to play at ${columnLetter}${rowNumber}`,
    { data: clickData }  // Optionally pass data
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

## How to Use the context API

### context Structure

The execute function receives `ToolContext`. Through this, you can access app features.

```typescript
interface ToolContext {
  currentResult?: ToolResult | null;  // Currently selected result (used when updating)
  app?: ToolContextApp;               // Features provided by the app
}
```

### Features Provided by context.app

MulmoChat's `context.app` provides the following features:

| Feature | Description | Return Value | Example Plugins |
|---------|-------------|--------------|-----------------|
| `getConfig(key)` | Get configuration value | `T \| undefined` | SetImageStyle |
| `setConfig(key, value)` | Save configuration value *Allowed plugins only | `void` | SetImageStyle |
| `generateImage(prompt)` | Generate image | `Promise<string>` | GenerateImage |
| `editImage(prompt)` | Edit image | `Promise<string>` | EditImage |
| `generateHtml({ prompt })` | Generate HTML with LLM | `Promise<{ success, html?, error? }>` | GenerateHtml, EditHtml |
| `browseUrl(url)` | Fetch web page | `Promise<BrowseResult>` | Browse |
| `getTwitterEmbed(url)` | Get Twitter embed | `Promise<string>` | Browse |
| `searchExa(args)` | Exa search | `Promise<SearchResult>` | Exa |
| `summarizePdf(params)` | Summarize PDF | `Promise<string>` | SummarizePdf |
| `saveImages({ uuid, images })` | Save images | `Promise<SaveResult>` | Canvas, Markdown |
| `getImageConfig()` | Get image generation config | `ImageGenerationConfig` | SetImageStyle |
| `getRoles()` | Get role list | `Role[]` | SwitchRole |
| `switchRole(roleId)` | Switch role | `void` | SwitchRole |

### Concrete Implementation Examples

#### Example 1: Call Backend (GenerateHtml)

```typescript
// GUIChatPluginGenerateHtml/src/core/plugin.ts
export const executeGenerateHtml = async (
  context: ToolContext,
  args: GenerateHtmlArgs,
): Promise<ToolResult<HtmlToolData>> => {
  const { prompt } = args;

  // 1. Check feature availability (required)
  if (!context.app?.generateHtml) {
    return {
      message: "generateHtml function not available",
      instructions: "Acknowledge that the HTML generation failed.",
    };
  }

  try {
    // 2. Call backend
    const data = await context.app.generateHtml({ prompt });

    // 3. Return based on result
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

// Set isEnabled and backends in pluginCore
export const pluginCore = {
  // ...
  isEnabled: (startResponse) =>
    !!startResponse?.hasAnthropicApiKey || !!startResponse?.hasGoogleApiKey,
  backends: ["textLLM"],  // Explicitly specify backend used
};
```

#### Example 2: Fetch Web Page (Browse)

```typescript
// GUIChatPluginBrowse/src/core/plugin.ts
export const browse = async (
  context: ToolContext,
  args: BrowseArgs,
): Promise<BrowseResult> => {
  const { url } = args;

  // Get embed for Twitter URLs
  if (isTwitterUrl(url)) {
    const embedHtml = await context.app?.getTwitterEmbed?.(url);
    // Save embedHtml...
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
        jsonData: { data: data.data },  // Return page content to LLM
        data: { url, twitterEmbedHtml },  // Data for UI
        instructions: "Give a ONE-SENTENCE summary of the content.",
      };
    }
  } catch (error) {
    // Error handling
  }
};
```

#### Example 3: Read/Write Configuration (SetImageStyle)

```typescript
// GUIChatPluginSetImageStyle/src/core/plugin.ts
export const executeSetImageStyle = async (
  context: ToolContext,
  args: SetImageStyleArgs,
): Promise<ToolResult<SetImageStyleData, SetImageStyleJsonData>> => {
  const { styleModifier } = args;

  // Cast context.app to extended type
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
    // Get current config
    const config = app.getImageConfig();
    const previousStyleModifier = config.styleModifier || "";

    // Create new config
    const newConfig: ImageGenerationConfig = {
      ...config,
      styleModifier: styleModifier.trim(),
    };

    // Save config with setConfig (only available to allowed plugins)
    app.setConfig?.("imageGenerationBackend", newConfig);

    return {
      message: `Image style set to: ${styleModifier.trim()}`,
      data: { styleModifier: styleModifier.trim(), previousStyleModifier },
      jsonData: { success: true, styleModifier: styleModifier.trim() },
      instructions: `Acknowledge that all future images will use the style: "${styleModifier.trim()}"`,
      instructionsRequired: true,
    };
  } catch (error) {
    // Error handling
  }
};
```

**Note:** `setConfig` is only available to plugins allowed by MulmoChat (security measure).

#### Example 4: Update Existing Result (ScrollToAnchor)

```typescript
// GUIChatPluginScrollToAnchor/src/core/plugin.ts
export const executeScrollToAnchor = async (
  context: ToolContext,
  args: ScrollToAnchorArgs,
): Promise<ToolResult> => {
  const { anchorId } = args;

  // Check currentResult exists
  if (!context.currentResult) {
    return {
      message: "No document is currently displayed to scroll.",
      updating: false,
    };
  }

  // Copy existing result and update viewState
  return {
    ...context.currentResult,
    message: `Scrolled to ${anchorId}`,
    updating: true,  // Important: Update existing result instead of creating new
    viewState: {
      ...context.currentResult.viewState,
      scrollToAnchor: anchorId,
      scrollTimestamp: Date.now(),  // Add timestamp to react even to same anchor
    },
    instructions: "Read the step aloud.",
    instructionsRequired: true,
  };
};
```

#### Example 5: Use App-Specific Features (SwitchRole)

```typescript
// GUIChatPluginSwitchRole/src/core/plugin.ts

// Extend context with required features type definition
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

  // Check if getRoles is available
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

  // Call switchRole asynchronously (uses setTimeout due to connection disconnect)
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

### Pattern-Based Implementation

#### Pattern A: Call Backend

**Reference:** [GUIChatPluginGenerateHtml](https://github.com/nicedoc/GUIChatPluginGenerateHtml)

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

// Check backend availability in isEnabled
export const pluginCore = {
  isEnabled: (startResponse) =>
    !!startResponse?.hasAnthropicApiKey || !!startResponse?.hasGoogleApiKey,
  backends: ["textLLM"],
};
```

#### Pattern B: Update Existing Result

**Reference:** [GUIChatPluginScrollToAnchor](https://github.com/nicedoc/GUIChatPluginScrollToAnchor)

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
    updating: true,  // Update existing result
    viewState: {
      ...context.currentResult.viewState,
      scrollToAnchor: args.anchorId,
    },
  };
};
```

#### Pattern C: Use App-Specific Features

**Reference:** [GUIChatPluginSwitchRole](https://github.com/nicedoc/GUIChatPluginSwitchRole)

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

## Shared UI Components

When using common UI across multiple plugins, you can use shared packages.

### @mulmochat-plugin/ui-image

Provides shared components for image display. Used by GenerateImage, EditImage, etc.

```typescript
// src/vue/View.vue
import { ImageView } from "@mulmochat-plugin/ui-image";

// src/vue/Preview.vue
import { ImagePreview } from "@mulmochat-plugin/ui-image";
```

**package.json configuration:**

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

## Implementation Example: Image Generation Plugin

The image generation plugin uses `context.app.generateImage()` and accepts file uploads via `inputHandlers`.

**Reference:** [@mulmochat-plugin/generate-image](https://www.npmjs.com/package/@mulmochat-plugin/generate-image)

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

// Helper: Create ToolResult from uploaded image
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

// execute: Return result from context.app.generateImage() directly
export const executeGenerateImage = async (
  context: ToolContext,
  args: GenerateImageArgs,
): Promise<ToolResult<ImageToolData, never>> => {
  const { prompt } = args;

  if (!context.app?.generateImage) {
    return { message: "generateImage function not available" };
  }

  // generateImage returns ToolResult
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

Image plugin samples include pre-loaded images for demo.

```typescript
import type { ToolSample } from "gui-chat-protocol";

// Demo samples: Set URL in imageData (displayed as image at runtime)
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

### Vue Components (Using Shared Package)

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

## Reference Plugin List

| Plugin | Features | Reference Points |
|--------|----------|------------------|
| **[@mulmochat-plugin/generate-image](https://www.npmjs.com/package/@mulmochat-plugin/generate-image)** | Image generation | inputHandlers, backends, shared UI |
| **[Othello](https://github.com/nicedoc/GUIChatPluginOthello)** | Game, interactive UI | samples, sendTextMessage, jsonData |
| **[GenerateHtml](https://github.com/nicedoc/GUIChatPluginGenerateHtml)** | Backend call | context.app, isEnabled, backends |
| **[ScrollToAnchor](https://github.com/nicedoc/GUIChatPluginScrollToAnchor)** | Result update | updating, viewState, currentResult |
| **[SwitchRole](https://github.com/nicedoc/GUIChatPluginSwitchRole)** | App feature call | context extension, custom functions |
| **[Quiz](https://github.com/receptron/MulmoChatPluginQuiz)** | Simple data display | samples, View, Preview |
| **[Spreadsheet](https://github.com/nicedoc/GUIChatPluginSpreadsheet)** | Complex logic | logic.ts separation, formula calculation |

---

## Completion Checklist

### Required Files

- [ ] `package.json` - name: `@gui-chat-plugin/xxx`, description, keywords
- [ ] `vite.config.ts` - name: `GUIChatPluginXxx`
- [ ] `tsconfig.json`
- [ ] `tsconfig.build.json`
- [ ] `eslint.config.js`
- [ ] `.gitignore`
- [ ] `index.html` - Change title
- [ ] `README.md` - Plugin description, installation method, Test Prompts
- [ ] `.github/workflows/pull_request.yaml`

### src Files

- [ ] `src/style.css` - `@import "tailwindcss";`
- [ ] `src/index.ts` - `export * from "./core";`
- [ ] **No Tailwind arbitrary values** - Use standard classes only (no `bg-[#xxx]`, `w-[xxx]` etc.)

### Core Files

- [ ] `src/core/types.ts` - XxxToolData, XxxArgs, (XxxJsonData)
- [ ] `src/core/definition.ts` - TOOL_NAME, TOOL_DEFINITION, SYSTEM_PROMPT
- [ ] `src/core/plugin.ts` - executeXxx, pluginCore
- [ ] `src/core/index.ts` - Export everything
- [ ] `src/core/samples.ts` - Test samples

### Vue Files

- [ ] `src/vue/index.ts` - plugin, exports, `export default { plugin }`
- [ ] `src/vue/View.vue` - `selectedResult` props, `sendTextMessage` props
- [ ] `src/vue/Preview.vue` - `result` props

### Demo Files

- [ ] `demo/main.ts`
- [ ] `demo/App.vue` - samples buttons, View display, Preview display

### Build Verification

- [ ] `yarn install` succeeds
- [ ] `yarn typecheck` no errors
- [ ] `yarn lint` no errors
- [ ] `yarn build` succeeds
- [ ] `yarn dev` demo works

### MulmoChat Integration

- [ ] Add to `package.json`: `"@gui-chat-plugin/xxx": "file:../GUIChatPluginXxx"`
- [ ] Add import to `src/tools/index.ts`
- [ ] Add CSS import to `src/main.ts`
- [ ] `yarn install` in MulmoChat
- [ ] `yarn typecheck` no errors in MulmoChat
- [ ] `yarn lint` no errors in MulmoChat

---

## AI Instruction Template

### New Plugin Creation

> **Important**: Plugin quality depends on the detail of the specification you provide.
> Describe parameter types, possible values, and UI behavior concretely.

```
Create a new GUIChat plugin.

Plugin name: @gui-chat-plugin/xxx
Function: {Detailed function description}

Tool Definition:
- name: xxxTool
- description: {Description for LLM}
- parameters:
  - paramName (type): {Description}
    - Required/Optional
    - Possible values (list if enum)
    - Default value

Implementation requirements:
- View: {Main screen display method, "none" if not needed}
  - Content to display
  - User interactions
  - Special UI elements (download button, etc.)
- Preview: {Thumbnail display method, "none" if not needed}
- Backend: {Backend to use, "none" if not needed}
- Samples: {Test samples}
- Domain logic: {Required calculations, rules, algorithms}

Reference: Follow the steps in docs/plugin-development-guide.md,
and verify with the checklist that nothing is missing.
```

### Extracting Existing Plugin

```
Extract MulmoChat internal plugin {pluginName} as an independent npm package.

Source files:
- src/tools/models/{pluginName}.ts
- src/tools/views/{PluginName}.vue
- src/tools/previews/{PluginName}.vue

Reference: Follow the steps in docs/plugin-extraction-guide.md,
and verify with the checklist that nothing is missing.
```
