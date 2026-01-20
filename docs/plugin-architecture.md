# GUIChat Plugin Architecture

This document describes the philosophy, overview, and architecture of the GUIChat/MulmoChat plugin system.

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Architecture Overview](#architecture-overview)
3. [gui-chat-protocol Package](#gui-chat-protocol-package)
4. [Plugin Structure](#plugin-structure)
5. [Type System](#type-system)
6. [Backend Abstraction](#backend-abstraction)
7. [External Input Handlers](#external-input-handlers)
8. [Future Extensions](#future-extensions)

---

## Design Philosophy

### Core Principles

The GUIChat plugin system is designed based on the following principles.

#### 1. Framework Agnostic

Plugin core logic does not depend on any specific UI framework (Vue, React, Svelte, etc.).

```
Plugin = Core Logic (Framework Agnostic) + UI Adapter (Framework Specific)
```

**Reasons:**
- Reusable in other projects
- Resilient to UI framework changes
- Easy to test

#### 2. Separation of Concerns

Each layer has clear responsibilities.

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Plugin** | Display UI from tool results, plugin-specific settings | Quiz display, image generation |
| **App Layer** | Backend configuration management, service provision to plugins | API key management, backend selection |
| **Backend Service** | External API wrappers | OpenAI, Google Maps, Exa |
| **Server** | Provide existing APIs | Authentication, proxy |

#### 3. Declarative Interface

Plugins declare "what they can do" and leave "how to do it" to the app layer.

```typescript
// Plugin declares only the type
backends: ["textLLM"],  // Uses text generation LLM

// Specific provider selection is managed by app layer
// Whether to use Claude or Gemini is selected by user in settings
```

#### 4. Type Safety

All interfaces are strictly typed in TypeScript.

```typescript
// Clearly defined with type parameters
ToolPlugin<T, J, A>
//        │  │  └── A: Argument type
//        │  └───── J: Data type returned to LLM
//        └──────── T: Data type for UI
```

---

## Architecture Overview

### Overall Picture

```
┌─────────────────────────────────────────────────────────────┐
│                        Host App                             │
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
│            (Common Type Definitions & Interfaces)           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input → LLM → Tool Call → execute() → ToolResult → View/Preview
     ↑                                                        │
     └─────────────── instructions to LLM ←───────────────────┘
```

1. **User Input**: Instructions via voice or text
2. **LLM Processing**: Determines which tool to use
3. **Tool Call**: Executes plugin's `execute()` function
4. **ToolResult**: Returns execution result
5. **UI Display**: Shows result in View/Preview components
6. **Instructions to LLM**: Instructs next action via `instructions`

### Component Roles

```
┌─────────────────────────────────────────────────────┐
│                    MulmoChat UI                      │
├──────────────┬──────────────────────────────────────┤
│   Sidebar    │              Canvas                   │
│              │                                       │
│ ┌──────────┐ │   ┌─────────────────────────────┐    │
│ │ Preview  │ │   │                             │    │
│ │ Thumbnail│◄──┤         View                 │    │
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

## gui-chat-protocol Package

### Overview

`gui-chat-protocol` is a TypeScript library that defines the standard protocol for GUIChat plugins.

```bash
npm install gui-chat-protocol
```

### Package Structure

```
gui-chat-protocol/
├── index.ts    # Core: ToolPluginCore, ToolContext, ToolResult, etc.
├── vue.ts      # Vue: ToolPluginVue, ToolPlugin (alias)
└── react.ts    # React: ToolPluginReact
```

### Export Classification

| Export Source | Contents | Dependencies |
|--------------|----------|--------------|
| `.` (core) | `ToolPluginCore`, `ToolResult`, `ToolContext`, `ToolDefinition` | None |
| `./vue` | `ToolPluginVue`, `ToolPlugin` | Vue |
| `./react` | `ToolPluginReact` | React |

### Usage Examples

```typescript
// Core logic only (no UI)
import type { ToolPluginCore, ToolContext, ToolResult } from "gui-chat-protocol";

// Vue application
import type { ToolPlugin } from "gui-chat-protocol/vue";

// React application
import type { ToolPluginReact } from "gui-chat-protocol/react";
```

---

## Plugin Structure

### Directory Structure

```
GUIChatPluginXxx/
├── package.json              # npm package configuration
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
├── src/
│   ├── index.ts              # Main entry (re-exports core)
│   ├── style.css             # Tailwind CSS import
│   ├── core/                 # Framework-agnostic core
│   │   ├── index.ts          # Core exports
│   │   ├── types.ts          # Plugin-specific type definitions
│   │   ├── definition.ts     # Tool definition (schema, SYSTEM_PROMPT)
│   │   ├── plugin.ts         # execute function and pluginCore
│   │   ├── samples.ts        # Test samples
│   │   └── logic.ts          # Business logic (optional)
│   └── vue/
│       ├── index.ts          # Vue plugin exports
│       ├── View.vue          # Main view component
│       └── Preview.vue       # Preview component
└── demo/
    ├── App.vue               # Demo app
    └── main.ts               # Demo entry point
```

### Core and Vue Separation

**Core (Framework Agnostic):**

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

**Vue (UI Adapter):**

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

### Package Exports

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

## Type System

### Main Types

#### ToolPluginCore

Framework-agnostic plugin definition.

```typescript
interface ToolPluginCore<T, J, A> {
  toolDefinition: ToolDefinition;    // Tool definition for LLM
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;          // Message displayed during processing
  waitingMessage?: string;            // Message to LLM before showing result
  isEnabled: (startResponse?) => boolean;  // Whether plugin is enabled
  systemPrompt?: string;              // Additional instructions to LLM
  samples?: ToolSample[];             // Test samples
  backends?: BackendType[];           // Backends used
  inputHandlers?: InputHandler[];     // File/clipboard input
}
```

#### ToolResult

Tool execution result.

```typescript
interface ToolResult<T, J> {
  message: string;              // Status message to LLM (required)
  data?: T;                     // Data for View/Preview (not sent to LLM)
  jsonData?: J;                 // JSON data returned to LLM
  title?: string;               // Result title
  instructions?: string;        // Additional instructions to LLM
  instructionsRequired?: boolean; // Whether to always send instructions
  updating?: boolean;           // Whether to update existing result
  viewState?: Record<string, unknown>; // View state
}
```

#### ToolContext

Context during tool execution.

```typescript
interface ToolContext {
  currentResult?: ToolResult | null;  // Currently selected result
  app?: ToolContextApp;               // Features provided by app
}
```

### Type Parameter Explanation

```typescript
ToolPlugin<T, J, A>
```

| Parameter | Description | Usage |
|-----------|-------------|-------|
| `T` | Type of `result.data` | Data for UI display (not sent to LLM) |
| `J` | Type of `result.jsonData` | Data returned to LLM |
| `A` | Type of `execute` function arguments | Tool parameters |

### Type Usage Guidelines

| Data | Storage Location | Destination | Example |
|------|-----------------|-------------|---------|
| Large data for UI display | `result.data` | View/Preview only | Image data, HTML |
| Data for LLM decision making | `result.jsonData` | LLM | Game state, legal moves |
| Brief status | `result.message` | LLM | "Image generated" |

---

## Backend Abstraction

### Design Philosophy

Plugins don't know specific AI providers; they only declare "backend types".

```typescript
// Before: Plugin has provider selection UI (problematic)
config: {
  component: HtmlGenerationConfig,  // Claude or Gemini selection
}

// After: Plugin only declares type (recommended)
backends: ["textLLM"],
```

### Backend Types

```typescript
type BackendType =
  | "textLLM"    // Text generation LLM (Claude, Gemini)
  | "imageGen"   // Image generation (DALL-E, Imagen)
  | "audio"      // Audio processing
  | "search"     // Search (Exa)
  | "browse"     // Web browsing
  | "map"        // Maps (Google Maps)
  | "mulmocast"; // Mulmocast
```

### Layer Structure

```
┌─────────────────────────────────────────┐
│  Plugin                                  │
│  backends: ["textLLM"]                   │ ← Declares type only
├─────────────────────────────────────────┤
│  App Layer (Configuration Management)    │
│  textLLM: { provider: "anthropic" }     │ ← Specific provider
├─────────────────────────────────────────┤
│  Backend Service                         │
│  Anthropic API / Google API             │ ← Actual API calls
└─────────────────────────────────────────┘
```

### Features Provided by context.app

| Feature | Description | Backend Used |
|---------|-------------|--------------|
| `generateImage(prompt)` | Image generation | `imageGen` |
| `generateHtml({ prompt })` | HTML generation | `textLLM` |
| `browseUrl(url)` | Fetch web page | `browse` |
| `searchExa(args)` | Exa search | `search` |
| `getConfig(key)` | Get configuration value | - |
| `setConfig(key, value)` | Save configuration value | - |

---

## External Input Handlers

### Overview

A mechanism for plugins to accept file uploads and clipboard input.

### InputHandler Types

```typescript
type InputHandler =
  | FileInputHandler        // File upload
  | ClipboardImageInputHandler  // Clipboard image
  | UrlInputHandler         // URL input
  | TextInputHandler        // Text input
  | CameraInputHandler      // Camera capture
  | AudioInputHandler;      // Audio input
```

### Usage Example

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

## Future Extensions

### Resource Reference System

Enable tool results to be referenced from other tools.

```typescript
interface ToolContext {
  // Existing
  currentResult?: ToolResult | null;
  app?: ToolContextApp;

  // Future addition
  results?: {
    getById: (uuid: string) => ToolResultComplete | null;
    getByType: (resourceType: string) => ToolResultComplete[];
  };
}
```

**Expected Benefits:**
- Enables "use the image I just created"
- Explicit data sharing between tools

### Tool Capabilities Declaration

Declare what tools can do.

```typescript
interface ToolCapabilities {
  outputType?: "image" | "document" | "chart" | "audio" | "data";
  acceptsInputTypes?: string[];
  streaming?: boolean;
  undoable?: boolean;
}
```

**Expected Benefits:**
- LLM can make appropriate decisions when selecting tools
- Host app can dynamically adjust UI

### Streaming Execution

Display progress in real-time for long-running processes.

```typescript
interface ToolPluginCore {
  execute: (context, args) => Promise<ToolResult>;

  // Future addition
  executeStream?: (
    context,
    args,
    onProgress: (update: StreamUpdate) => void
  ) => Promise<ToolResult>;
}
```

---

## References

### Related Documents

| Document | Contents |
|----------|----------|
| [plugin-development-guide.md](./plugin-development-guide.md) | Detailed plugin development procedures |
| [plugin-extraction-guide.md](./plugin-extraction-guide.md) | Procedures for extracting existing plugins |

### Existing Plugin List

| Package Name | Features |
|-------------|----------|
| `@gui-chat-plugin/quiz` | Uses jsonData, simple data display |
| `@gui-chat-plugin/generate-image` | inputHandlers, backends, shared UI |
| `@gui-chat-plugin/othello` | Game, interactive UI, sendTextMessage |
| `@gui-chat-plugin/generate-html` | context.app, isEnabled, backends |
| `@gui-chat-plugin/scroll-to-anchor` | updating, viewState, currentResult |
| `@gui-chat-plugin/switch-role` | context extension, custom functions |
| `@gui-chat-plugin/spreadsheet` | Complex logic, logic.ts separation |

### External Resources

- [gui-chat-protocol npm package](https://www.npmjs.com/package/gui-chat-protocol)
- [Vue 3 Components](https://vuejs.org/guide/components/registration.html)
- [Vite Library Mode](https://vitejs.dev/guide/build.html#library-mode)
