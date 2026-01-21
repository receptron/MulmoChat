# LLM Native OS Vision

Design vision and development roadmap viewing MulmoChat as an "OS" and plugins as "LLM Native Applications".

> **Note**: This document builds upon the [GUI Chat Protocol](../GUI_CHAT_PROTOCOL.md) as its foundation. It describes extensions to the core concepts defined in GUI Chat Protocol (Enhanced Tool Calls, Typed Return Data, Roles, Chat-Centric OS), adding new capabilities such as agentic execution, MCP integration, and resource references.

## Table of Contents

1. [Concept](#concept)
2. [Architecture Layers](#architecture-layers)
3. [Current Features](#current-features)
4. [Missing Features](#missing-features)
5. [Development Roadmap](#development-roadmap)
6. [Design Principles](#design-principles)
7. [Portability](#portability)

---

## Concept

### What is LLM Native OS

Just as traditional operating systems abstract hardware and provide APIs to applications, an LLM Native OS abstracts the LLM and provides a unified interface to applications (plugins).

```
Traditional OS                      LLM Native OS
─────────────────────────────────────────────────────
Applications                        Plugins (LLM Native Apps)
    ↓                                  ↓
System Calls                        context.app API
    ↓                                  ↓
Kernel                              LLM Native OS Core
    ↓                                  ↓
Hardware                            LLM / Backend Services
```

### Why This Perspective Matters

1. **Feature Discovery**: Comparing with traditional OS features reveals what's needed
2. **Design Guidance**: Clear responsibilities for each layer improve modular design
3. **Ecosystem Formation**: More plugin developers lead to richer applications
4. **Portability**: Abstracting the OS layer allows plugin sharing across different host apps

---

## Architecture Layers

### 4-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│               (Plugins / LLM Native Apps)                    │
│                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│   │ Weather │  │ Othello │  │   Map   │  │  HTML   │      │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
├─────────────────────────────────────────────────────────────┤
│                      OS Layer (Core)                         │
│                    gui-chat-protocol                         │
│                                                             │
│  • Type definitions (ToolPlugin, ToolResult, ToolContext)   │
│  • Protocol (Plugin ↔ OS contract)                          │
│  • Resource management (future)                             │
│  • Permissions (future)                                     │
├─────────────────────────────────────────────────────────────┤
│                     Host App Layer                           │
│               (MulmoChat, future apps)                       │
│                                                             │
│  • UI framework implementation (Vue/React)                  │
│  • Session management                                       │
│  • User settings                                            │
│  • context.app implementation                               │
├─────────────────────────────────────────────────────────────┤
│                     Backend Layer                            │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ textLLM │  │imageGen │  │ search  │  │   map   │      │
│  │(Claude) │  │(Gemini) │  │  (Exa)  │  │(Google) │      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | Implementation |
|-------|---------------|----------------|
| **Application Layer** | User-facing features | Individual plugin packages |
| **OS Layer** | Standard protocol, inter-layer contracts | gui-chat-protocol |
| **Host App Layer** | UI implementation, session management, API provision | MulmoChat |
| **Backend Layer** | External service communication | Server / APIs |

---

## Current Features

### Implemented ✅

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Tool Execution** | LLM calls plugins | execute() |
| **UI Display** | Result display (View/Preview) | Vue components |
| **Backend Abstraction** | Provider-independent | backends declaration |
| **External Input** | File/clipboard | inputHandlers |
| **Config Management** | Plugin settings storage | getConfig/setConfig |
| **Config UI Delegation** | Delegate plugin config UI to app | ToolPluginConfig |
| **LLM Instructions** | Post-execution instructions | instructions |
| **State Updates** | Update existing results | updating flag |

---

## Missing Features

### Priority: High 🔴

#### 1. Agentic Execution System

**Current Problem:**
- Only simple user question → response loop
- Cannot automatically complete multi-step tasks
- Cannot auto-correct and retry on errors
- Cannot manage multiple requests in parallel

**Required Features:**

##### 1.1 Auto-Loop Execution (attempt_completion pattern)

```typescript
interface TaskExecution {
  // Task completion check
  attemptCompletion: () => CompletionResult;

  // Continue execution
  continueExecution: () => Promise<void>;

  // Request user confirmation when needed
  requestUserConfirmation: (question: string) => Promise<boolean>;
}

type CompletionResult =
  | { status: "completed"; summary: string }
  | { status: "needs_more_work"; nextAction: string }
  | { status: "needs_user_input"; question: string }
  | { status: "error"; error: string; canRetry: boolean };
```

##### 1.2 Task & Context Management

```typescript
interface TaskContext {
  id: string;

  // Task purpose/intent
  purpose: {
    original: string;        // User's original request
    clarified: string;       // Clarified purpose
    confirmedByUser: boolean;
  };

  // State management
  state: TaskState;

  // Todo list
  todos: TodoItem[];

  // Execution history
  history: ExecutionRecord[];

  // Related resources
  resources: ResourceReference[];

  // Error history and learning
  errors: ErrorRecord[];
}

type TaskState =
  | "planning"      // Planning
  | "executing"     // Executing
  | "waiting_user"  // Waiting for user input
  | "error"         // Error occurred
  | "completed";    // Completed

interface TodoItem {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: unknown;
}

interface ExecutionRecord {
  timestamp: Date;
  action: string;
  toolUsed?: string;
  input?: unknown;
  output?: unknown;
  success: boolean;
}
```

##### 1.3 Auto Error Correction

```typescript
interface ErrorHandler {
  // Error analysis
  analyzeError: (error: Error, context: TaskContext) => ErrorAnalysis;

  // Attempt auto-fix
  attemptAutoFix: (analysis: ErrorAnalysis) => Promise<FixResult>;

  // Retry strategy
  getRetryStrategy: (error: Error) => RetryStrategy;
}

interface ErrorAnalysis {
  type: "input_error" | "api_error" | "logic_error" | "resource_missing";
  cause: string;
  suggestedFix: string;
  canAutoFix: boolean;
}

interface RetryStrategy {
  shouldRetry: boolean;
  maxAttempts: number;
  backoffMs: number;
  modifyInput?: (original: unknown) => unknown;
}
```

##### 1.4 Multi-Task Management

```typescript
interface TaskManager {
  // Create task
  createTask: (userRequest: string) => TaskContext;

  // Get active tasks
  getActiveTasks: () => TaskContext[];

  // Switch task
  switchTask: (taskId: string) => void;

  // Update task purpose
  updatePurpose: (taskId: string, newPurpose: string) => void;

  // Confirm purpose with user
  confirmPurposeWithUser: (taskId: string) => Promise<boolean>;
}
```

**Detailed User Experience Examples:**

##### Example 1: Multi-Step Task Auto-Execution

```
User: "Write a blog post, generate images, and compile into HTML"

┌─────────────────────────────────────────────────────────────────┐
│ TaskContext Created                                             │
├─────────────────────────────────────────────────────────────────┤
│ id: "task-001"                                                  │
│ purpose:                                                        │
│   original: "Write a blog post, generate images, compile HTML"  │
│   clarified: "Create a blog post about AI technology,           │
│              generate 3 related images, output as HTML page"    │
│   confirmedByUser: false  ← Confirm with user if needed         │
│                                                                 │
│ state: "planning"                                               │
│                                                                 │
│ todos:                                                          │
│   [1] Write blog article (pending)                              │
│   [2] Generate 3 images matching the article (pending)          │
│   [3] Compile article and images into HTML (pending)            │
└─────────────────────────────────────────────────────────────────┘

System: "Let me confirm the blog topic. Is AI technology in general OK?
        Or do you have a specific topic (Generative AI, ML, etc.)?"

User: "Latest trends in generative AI"

┌─────────────────────────────────────────────────────────────────┐
│ TaskContext Updated                                             │
├─────────────────────────────────────────────────────────────────┤
│ purpose:                                                        │
│   clarified: "Create blog post about latest generative AI..."   │
│   confirmedByUser: true  ✓                                      │
│                                                                 │
│ state: "executing"                                              │
└─────────────────────────────────────────────────────────────────┘

[Auto-execution loop started]

Step 1: Write blog article
  → Call textLLM plugin
  → Result: 2000-word article generated
  → todos[1].status = "completed"
  → Record in history

Step 2: Generate images
  → Call imageGen plugin
  → Error: "Rate limit exceeded"

[Auto error correction]
  → ErrorAnalysis: { type: "api_error", canAutoFix: true }
  → RetryStrategy: { shouldRetry: true, backoffMs: 5000 }
  → Wait 5 seconds, retry
  → Success: 3 images generated
  → todos[2].status = "completed"

Step 3: Create HTML
  → Get article and images via resource reference system
  → Call generateHtml plugin
  → Result: Complete HTML page generated
  → todos[3].status = "completed"

[attemptCompletion]
  → All todos are completed
  → status: "completed"
  → summary: "Created blog post about latest generative AI trends,
             3 images, and HTML page"

System: "Done! I've created a blog post about latest generative AI trends,
        3 images, and an HTML page.
        The HTML page is displayed in the preview."
```

##### Example 2: Auto Error Correction with User Confirmation

```
User: "Check Tokyo weather and suggest appropriate clothing"

[Auto-execution loop]

Step 1: Get weather info
  → Call weather plugin
  → Error: "Location ambiguous: Tokyo Prefecture? Tokyo Station?"

[Auto error correction decision]
  → ErrorAnalysis: { type: "input_error", canAutoFix: false }
  → User confirmation required

System: "I couldn't identify 'Tokyo' precisely.
        Which one do you mean?
        1. Tokyo Prefecture (downtown weather)
        2. Tokyo Station (pinpoint weather)"

User: "1"

[TaskContext updated, execution resumed]
  → Tokyo Prefecture weather retrieved successfully
  → "Sunny, high 28°C, humidity 60%"

Step 2: Clothing suggestion
  → Call textLLM plugin
  → Get weather info via resource reference
  → Generate clothing suggestion

[attemptCompletion]
  → status: "completed"
  → summary: "Tokyo Prefecture is sunny at 28°C.
             Light shirt and pants recommended."
```

##### Example 3: Multi-Task Parallel Management

```
User: "Create a presentation. Oh, but first I want to check today's schedule"

[Multi-task management]

┌─────────────────────────────────────────────────────────────────┐
│ TaskManager.getActiveTasks()                                    │
├─────────────────────────────────────────────────────────────────┤
│ Task 1 (task-001):                                              │
│   purpose: "Create presentation"                                │
│   state: "waiting_user"  ← Waiting for details                  │
│   todos: [Decide theme, Create slides, ...]                     │
│                                                                 │
│ Task 2 (task-002):                                              │
│   purpose: "Check today's schedule"                             │
│   state: "executing"  ← Currently running                       │
│   todos: [Check calendar]                                       │
└─────────────────────────────────────────────────────────────────┘

System: "I'm managing 2 tasks.
        Let me check today's schedule first."

[Task 2 execution]
  → Call calendar plugin
  → "10:00 Team meeting, 14:00 Client call"
  → Task 2 completed

System: "Today's schedule: 10:00 Team meeting, 14:00 Client call

        Now, let's get back to the presentation.
        What topic is the presentation about?"

[Switch to Task 1]
  → TaskManager.switchTask("task-001")
  → state: "waiting_user" → Waiting for user input
```

##### Example 4: Purpose Modification

```
[Running task]
TaskContext:
  purpose: "Create product landing page"
  state: "executing"
  todos:
    [1] Write product description (completed)
    [2] Generate product images (in_progress)
    [3] Create HTML page (pending)

User: "Actually, never mind the landing page.
      Just the SNS post images will do."

[Purpose modification]
  → TaskManager.updatePurpose("task-001", "Create SNS product images")

┌─────────────────────────────────────────────────────────────────┐
│ TaskContext Updated                                             │
├─────────────────────────────────────────────────────────────────┤
│ purpose:                                                        │
│   original: "Create product landing page"                       │
│   clarified: "Create SNS product images"  ← Modified            │
│   confirmedByUser: true                                         │
│                                                                 │
│ todos:                                                          │
│   [1] Write product description (completed) → Reuse as-is       │
│   [2] Generate SNS product images (in_progress) ← Direction changed │
│   [3] Create HTML page (pending) → Removed                      │
└─────────────────────────────────────────────────────────────────┘

System: "Got it. Switching to SNS image creation.
        I'll use the product description we already created
        to generate Instagram-ready images."
```

**Impact:**
- Automatic completion of complex tasks
- Auto-recovery from errors
- Parallel management of multiple tasks
- Accurate understanding and execution of user intent

**Design Considerations:**
- TaskContext persisted for cross-session continuity
- User can check/modify task state anytime
- Execution limit setting (prevent infinite loops)
- Request user confirmation for important decisions

---

#### 2. Resource Reference System (Inter-App Communication)

**Current Problem:**
- Cannot share data between plugins
- "Edit the image I just generated" is not possible
- LLM cannot reference past tool results

**Required Features:**
```typescript
interface ToolContext {
  // Existing
  currentResult?: ToolResult | null;
  app?: ToolContextApp;

  // Addition
  resources?: {
    getById: (uuid: string) => Resource | null;
    getByType: (type: ResourceType) => Resource[];
    getRecent: (count: number) => Resource[];
  };
}

type ResourceType = "image" | "document" | "data" | "audio" | "video";
```

**Impact:**
- LLM can chain tool results in pipelines
- Workflow automation
- Significant UX improvement

**Design Considerations:**
- Separate lightweight references (ID + metadata) from actual data
- Memory efficiency (load large data only when needed)
- Add to gui-chat-protocol (host app independent)

---

#### 2. Enhanced Persistence (Persistent Storage)

**Current Problem:**
- Data lost when session ends
- Cannot store structured data
- Cannot share data between plugins

**Required Features:**
```typescript
interface ToolContextApp {
  // Existing
  getConfig: (key: string) => unknown;
  setConfig: (key: string, value: unknown) => void;

  // Addition
  storage: {
    // Key-Value storage
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;

    // File storage
    saveFile: (name: string, data: Blob) => Promise<string>;
    loadFile: (id: string) => Promise<Blob>;
    listFiles: (filter?: FileFilter) => Promise<FileInfo[]>;
  };
}
```

**Impact:**
- Cross-session workflows
- User work history retention
- Foundation for inter-plugin data sharing

---

#### 4. MCP Integration for Efficient Plugin Development

**Current Problem:**
- Creating plugins from scratch every time is tedious
- Tool logic (backend) and UI (frontend) are tightly coupled
- Cannot leverage existing MCP tool ecosystem

**Plugin Component Decomposition:**

```
Plugin = Tools (functionality) + View (UI)

Tools:
  - Tool definition (schema)
  - Execution logic (backend processing)
  → Can be provided via MCP

View:
  - Main display (View.vue)
  - Thumbnail (Preview.vue)
  → Frontend-specific
```

**What is MCP (Model Context Protocol):**

MCP is a standard protocol for providing tools to LLM applications.
Tools are implemented on the server side and called from clients (LLM apps).

```
┌─────────────────────────────────────────────────────────────────┐
│  Current: Plugin implements everything                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Plugin                                                         │
│  ├── toolDefinition (define yourself)                           │
│  ├── execute() (implement yourself)                             │
│  ├── View.vue (implement yourself)                              │
│  └── Preview.vue (implement yourself)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Proposed: Plugin as MCP + UI wrapper                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Plugin (thin wrapper)                                          │
│  ├── mcpTool: "weather" (reference MCP tool)                    │
│  ├── View.vue (implement UI only)                               │
│  └── Preview.vue (implement UI only)                            │
│          │                                                      │
│          ▼                                                      │
│  ┌─────────────────────────────────────────┐                   │
│  │  MCP Client (Host App Layer)             │                   │
│  │  - Connect to MCP servers                │                   │
│  │  - Proxy tool calls                      │                   │
│  └─────────────────────────────────────────┘                   │
│          │                                                      │
│          ▼                                                      │
│  ┌─────────────────────────────────────────┐                   │
│  │  MCP Server(s)                           │                   │
│  │  - Weather, Search, Database, etc.       │                   │
│  │  - Leverage existing ecosystem           │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Required Features:**

##### 4.1 MCP Tool Wrapper Plugin

```typescript
// Traditional: Implement everything yourself
export const pluginCore: ToolPluginCore = {
  toolDefinition: {
    name: "weather",
    description: "Get weather information",
    parameters: { /* schema definition */ }
  },
  execute: async (context, args) => {
    // Call weather API yourself
    const data = await fetchWeatherAPI(args.location);
    return { message: "Weather fetched", data };
  },
};

// Proposed: Reference MCP tool
export const pluginCore: ToolPluginCore = {
  // Reference MCP tool (toolDefinition obtained from MCP)
  mcpTool: {
    server: "weather-server",  // MCP server name
    tool: "get_weather",       // Tool name
  },

  // execute is auto-generated or can be omitted
  // Only implement if you need to transform MCP result for UI
  transformResult: (mcpResult) => ({
    message: mcpResult.content,
    data: { temperature: mcpResult.temperature, ... }
  }),
};
```

##### 4.2 MCP Server Management

```typescript
interface ToolContextApp {
  // Existing features...

  // MCP related
  mcp: {
    // List available MCP servers
    listServers: () => MCPServerInfo[];

    // Call MCP tool
    callTool: (server: string, tool: string, args: unknown) => Promise<MCPResult>;

    // Get MCP tool definition
    getToolDefinition: (server: string, tool: string) => ToolDefinition;
  };
}
```

##### 4.3 Plugin Types

```typescript
// 1. Full Plugin (traditional)
interface FullPlugin extends ToolPluginCore {
  toolDefinition: ToolDefinition;
  execute: ExecuteFunction;
  viewComponent: Component;
  previewComponent: Component;
}

// 2. MCP Wrapper Plugin (new)
interface MCPWrapperPlugin {
  // MCP tool reference
  mcpTool: {
    server: string;
    tool: string;
  };

  // Optional: result transformation
  transformResult?: (mcpResult: unknown) => ToolResult;

  // UI components
  viewComponent: Component;
  previewComponent?: Component;
}

// 3. UI Only Plugin (add UI to MCP tool)
interface UIOnlyPlugin {
  // Reference existing MCP tool or other plugin's tool
  toolRef: string;  // "mcp:weather-server/get_weather" or "plugin:weather"

  // Provide UI only
  viewComponent: Component;
  previewComponent?: Component;
}
```

**Concrete Examples:**

##### Example 1: Add UI to Existing MCP Tool

```
[Situation]
- MCP server "exa-search" already exists
- Provides search tool
- But no UI (text results only)

[Solution: UI Only Plugin]

// Plugin definition (minimal)
export const plugin: UIOnlyPlugin = {
  toolRef: "mcp:exa-search/search",

  viewComponent: SearchResultsView,  // Card format results display
  previewComponent: SearchPreview,   // Thumbnail
};

// Only implement View.vue
<template>
  <div class="search-results">
    <div v-for="result in results" class="result-card">
      <h3>{{ result.title }}</h3>
      <p>{{ result.snippet }}</p>
      <a :href="result.url">Details</a>
    </div>
  </div>
</template>
```

##### Example 2: MCP Tool + Custom Post-Processing

```
[Situation]
- MCP server "weather" returns meteorological data
- But user also wants "clothing suggestions" displayed

[Solution: MCP Wrapper Plugin with transformResult]

export const pluginCore: MCPWrapperPlugin = {
  mcpTool: {
    server: "weather",
    tool: "get_current_weather",
  },

  // Process MCP result
  transformResult: async (mcpResult, context) => {
    const weather = mcpResult;

    // Generate clothing suggestion with textLLM
    const suggestion = await context.app?.generateText({
      prompt: `Suggest clothing for ${weather.temperature}°C, ${weather.condition} weather`,
    });

    return {
      message: `${weather.location}: ${weather.temperature}°C`,
      data: {
        weather,
        clothingSuggestion: suggestion,
      },
    };
  },
};
```

##### Example 3: Combining Multiple MCP Tools

```
[Situation]
- "search" MCP server: Web search
- "browser" MCP server: Page fetching
- Want to combine them for "search and summarize"

[Solution: Full Plugin with MCP calls]

export const pluginCore: ToolPluginCore = {
  toolDefinition: {
    name: "search_and_summarize",
    description: "Search and summarize results",
    parameters: { query: { type: "string" } }
  },

  execute: async (context, args) => {
    // 1. Search via MCP
    const searchResults = await context.app?.mcp.callTool(
      "search", "web_search", { query: args.query }
    );

    // 2. Fetch top 3 pages
    const pages = await Promise.all(
      searchResults.slice(0, 3).map(r =>
        context.app?.mcp.callTool("browser", "fetch_page", { url: r.url })
      )
    );

    // 3. Summarize with textLLM
    const summary = await context.app?.generateText({
      prompt: `Summarize the following:\n${pages.join('\n')}`
    });

    return {
      message: "Search and summarize completed",
      data: { searchResults, summary },
    };
  },
};
```

**Development Flow Changes:**

```
Traditional plugin development:
1. Write tool definition
2. Research and implement backend API
3. Implement error handling
4. Implement View/Preview
5. Test
→ Takes 1-2 days

After MCP integration:
1. Find existing MCP tool (or create one)
2. Implement View/Preview
3. Implement transformResult if needed
→ Done in a few hours
```

**Architecture Impact:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│               (Plugins / LLM Native Apps)                        │
│                                                                 │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐                 │
│   │FullPlugin │  │MCP Wrapper│  │ UI Only   │                 │
│   │(Traditional)│  │ Plugin    │  │ Plugin    │                 │
│   └───────────┘  └───────────┘  └───────────┘                 │
├─────────────────────────────────────────────────────────────────┤
│                      OS Layer (Core)                             │
│                    gui-chat-protocol                             │
│                                                                 │
│  • ToolPluginCore / MCPWrapperPlugin / UIOnlyPlugin types       │
│  • MCP Client interface                                         │
├─────────────────────────────────────────────────────────────────┤
│                     Host App Layer                               │
│                                                                 │
│  ┌─────────────────────────────────────────┐                   │
│  │  MCP Client Implementation               │                   │
│  │  - Server connection management          │                   │
│  │  - Tool call proxy                       │                   │
│  └─────────────────────────────────────────┘                   │
├─────────────────────────────────────────────────────────────────┤
│                     Backend Layer                                │
│                                                                 │
│  ┌─────────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │    MCP      │  │   MCP   │  │   MCP   │  │ Direct  │      │
│  │   Server    │  │  Server │  │  Server │  │   API   │      │
│  │ (Weather)   │  │(Search) │  │(Browser)│  │(Legacy) │      │
│  └─────────────┘  └─────────┘  └─────────┘  └─────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

**Impact:**
- Significant reduction in plugin development time (just implement UI)
- Leverage MCP ecosystem (reuse existing tools)
- Clear separation of backend/frontend
- Easy tool sharing and reuse

**Design Considerations:**
- MCP server connection management at host app layer
- Plugins call via context.app.mcp without MCP awareness
- Maintain compatibility with existing non-MCP plugins
- MCP server security (connect only to trusted servers)

##### 4.4 Tool Interface Specification (RFC-like Approach)

**Problem:**
No mechanism to guarantee consistency between existing plugin backends and plugins.

**Proposal: Unified Tool Identifier and Interface Specification**

```typescript
// Unique tool identifier
type ToolURI = string;  // e.g., "guichat://weather/get_current"
                        //       "mcp://exa-search/search"
                        //       "plugin://othello/make_move"

// Tool interface specification
interface ToolSpec {
  // Identifier
  uri: ToolURI;
  version: string;  // Semantic versioning "1.0.0"

  // Interface definition (JSON Schema based)
  input: JSONSchema;
  output: JSONSchema;

  // Metadata
  metadata: {
    name: string;
    description: string;
    category: string;
    capabilities?: ToolCapabilities;
  };
}
```

**Tool Registration Registry:**

```typescript
interface ToolRegistry {
  // Register tool
  register: (spec: ToolSpec, implementation: ToolImplementation) => void;

  // Search tools
  lookup: (uri: ToolURI) => ToolSpec | null;
  search: (query: { category?: string; capability?: string }) => ToolSpec[];

  // Version compatibility check
  isCompatible: (required: ToolURI, available: ToolURI) => boolean;
}
```

**Consistency with Existing Plugins:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Existing Plugin → ToolSpec Generation                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  // Existing weather plugin                                     │
│  export const pluginCore = {                                    │
│    toolDefinition: { name: "weather", ... },                    │
│    execute: async (ctx, args) => { ... }                        │
│  };                                                             │
│                                                                 │
│  ↓ Auto-conversion                                              │
│                                                                 │
│  ToolSpec {                                                     │
│    uri: "plugin://weather/get_weather",                         │
│    version: "1.0.0",                                            │
│    input: { /* generated from toolDefinition.parameters */ },   │
│    output: { /* ToolResult schema */ },                         │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  MCP Tool → ToolSpec Mapping                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MCP Server "exa-search" tool "search"                          │
│                                                                 │
│  ↓ Auto-mapping                                                 │
│                                                                 │
│  ToolSpec {                                                     │
│    uri: "mcp://exa-search/search",                              │
│    version: "1.0.0",                                            │
│    input: { /* from MCP tool schema */ },                       │
│    output: { /* from MCP result schema */ },                    │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Achieving Interoperability:**

```typescript
// UI plugin references any tool
export const plugin: UIOnlyPlugin = {
  // Reference by ToolURI (doesn't care if implementation is plugin or MCP)
  toolRef: "guichat://weather/get_current",  // or "mcp://..." or "plugin://..."

  viewComponent: WeatherView,
};

// Host app routes to appropriate implementation
const result = await toolRegistry.execute("guichat://weather/get_current", args);
// → Registry resolves whether it's plugin or MCP implementation
```

**Version Management and Compatibility:**

```typescript
// Tool spec version management
const spec_v1: ToolSpec = {
  uri: "guichat://weather/get_current",
  version: "1.0.0",
  input: { location: "string" },
  output: { temperature: "number", condition: "string" },
};

const spec_v2: ToolSpec = {
  uri: "guichat://weather/get_current",
  version: "2.0.0",
  input: { location: "string", unit: "celsius | fahrenheit" },  // added
  output: { temperature: "number", condition: "string", humidity: "number" },  // added
};

// Compatibility check
toolRegistry.isCompatible("guichat://weather/get_current@^1.0.0", spec_v2);
// → true (backward compatible)
```

**Benefits:**
- Unified handling of existing plugins and MCP tools
- Explicit interface specification (RFC-like)
- Compatibility guarantee through version management
- Easy tool discovery and search

---

### Priority: Medium 🟡

#### 5. Unified Configuration System

**Current Mechanism:**

MulmoChat currently implements the following configuration flow:

```
localStorage ("plugin_configs_v1")
    ↓
useUserPreferences (state management)
    ↓
HomeView.vue (defines getPluginConfig function)
    ↓
useToolResults (builds ToolContext)
    ↓
context.app.getConfig() / setConfig()
    ↓
Plugin / Backend
```

**Current Problems:**
- Plugin configuration schemas are not explicitly defined
- Backend settings (which API to use, etc.) tend to be hardcoded
- Settings UI generation is manual for each plugin
- Inconsistent validation across settings
- Cannot express configuration dependencies (e.g., imageGen requires API key)

**Required Features:**

##### 5.1 Plugin Configuration Schema

```typescript
interface ToolPluginCore {
  // Existing fields...

  // Addition: Configuration schema
  configSchema?: ConfigSchema;
}

interface ConfigSchema {
  // Unique config key
  key: string;  // "imageGenerationBackend", "weather.location"

  // JSON Schema based schema definition
  schema: JSONSchema;

  // Default value
  defaultValue: unknown;

  // UI hints
  ui?: {
    label: string;
    description?: string;
    component?: "select" | "input" | "toggle" | "slider" | "custom";
    group?: string;  // Settings group ("backend", "appearance", etc.)
  };

  // Validation
  validate?: (value: unknown) => ValidationResult;

  // Dependencies
  dependencies?: ConfigDependency[];
}

interface ConfigDependency {
  // Dependent config key
  key: string;
  // Condition
  condition: "exists" | "equals" | "notEquals";
  value?: unknown;
}
```

##### 5.2 Backend Configuration Schema

```typescript
interface BackendConfig {
  // Backend type
  type: BackendType;  // "textLLM", "imageGen", etc.

  // Available providers
  providers: ProviderConfig[];

  // Selected provider
  selectedProvider: string;
}

interface ProviderConfig {
  id: string;           // "anthropic", "openai", "gemini"
  name: string;         // Display name
  configSchema: ConfigSchema[];  // Provider-specific settings

  // Required settings like API keys
  requiredSecrets?: SecretConfig[];
}

interface SecretConfig {
  key: string;           // "ANTHROPIC_API_KEY"
  label: string;         // "Anthropic API Key"
  description?: string;
  envVar?: string;       // Environment variable name (if set server-side)
}
```

##### 5.3 Auto-Generated Settings UI

```typescript
interface ToolContextApp {
  // Existing features...
  getConfig: <T>(key: string) => T | undefined;
  setConfig: (key: string, value: unknown) => void;

  // Addition: Configuration metadata
  config: {
    // Get schema for auto-generating UI from schema
    getSchema: (key: string) => ConfigSchema | undefined;

    // List all plugin config schemas
    getAllSchemas: () => ConfigSchema[];

    // Get backend configuration
    getBackendConfig: (type: BackendType) => BackendConfig;

    // Validate configuration
    validate: (key: string, value: unknown) => ValidationResult;

    // Subscribe to config changes
    subscribe: (key: string, callback: (value: unknown) => void) => () => void;
  };
}
```

**Concrete Examples:**

##### Example 1: Image Generation Plugin Configuration

```typescript
// Plugin declares configuration schema
export const pluginCore: ToolPluginCore = {
  toolDefinition: { /* ... */ },
  execute: async (context, args) => { /* ... */ },

  // Configuration schema
  configSchema: {
    key: "imageGenerationBackend",
    schema: {
      type: "object",
      properties: {
        backend: {
          type: "string",
          enum: ["gemini", "openai", "comfyui"],
          default: "gemini"
        },
        styleModifier: {
          type: "string",
          default: ""
        },
        geminiModel: {
          type: "string",
          enum: ["gemini-2.5-flash-image", "imagen-3.0"],
          default: "gemini-2.5-flash-image"
        }
      }
    },
    defaultValue: {
      backend: "gemini",
      styleModifier: "",
      geminiModel: "gemini-2.5-flash-image"
    },
    ui: {
      label: "Image Generation Settings",
      group: "backend",
      component: "custom"  // Use custom UI
    },
    dependencies: [
      {
        key: "secrets.GOOGLE_AI_API_KEY",
        condition: "exists"
      }
    ]
  }
};
```

##### Example 2: Weather Plugin Configuration

```typescript
export const pluginCore: ToolPluginCore = {
  toolDefinition: { /* ... */ },
  execute: async (context, args) => { /* ... */ },

  configSchema: {
    key: "weather.preferences",
    schema: {
      type: "object",
      properties: {
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          default: "celsius"
        },
        defaultLocation: {
          type: "string",
          default: ""
        }
      }
    },
    defaultValue: {
      unit: "celsius",
      defaultLocation: ""
    },
    ui: {
      label: "Weather Settings",
      group: "plugins",
      description: "Display settings for weather plugin"
    }
  }
};
```

##### Example 3: Backend Configuration

```typescript
// Host app defines backend configuration
const textLLMBackendConfig: BackendConfig = {
  type: "textLLM",
  providers: [
    {
      id: "anthropic",
      name: "Claude (Anthropic)",
      configSchema: [
        {
          key: "textLLM.anthropic.model",
          schema: {
            type: "string",
            enum: ["claude-3-5-sonnet", "claude-3-opus"],
            default: "claude-3-5-sonnet"
          },
          ui: { label: "Model" }
        }
      ],
      requiredSecrets: [
        {
          key: "ANTHROPIC_API_KEY",
          label: "Anthropic API Key",
          envVar: "ANTHROPIC_API_KEY"
        }
      ]
    },
    {
      id: "openai",
      name: "GPT (OpenAI)",
      configSchema: [
        {
          key: "textLLM.openai.model",
          schema: {
            type: "string",
            enum: ["gpt-4o", "gpt-4-turbo"],
            default: "gpt-4o"
          },
          ui: { label: "Model" }
        }
      ],
      requiredSecrets: [
        {
          key: "OPENAI_API_KEY",
          label: "OpenAI API Key"
        }
      ]
    }
  ],
  selectedProvider: "anthropic"
};
```

**Auto-Generated Settings UI on App Side:**

```vue
<!-- SettingsPanel.vue -->
<template>
  <div class="settings-panel">
    <!-- Plugin settings -->
    <section v-for="schema in pluginSchemas" :key="schema.key">
      <h3>{{ schema.ui?.label }}</h3>

      <!-- Auto-generate UI based on schema -->
      <ConfigField
        :schema="schema"
        :value="getConfig(schema.key)"
        @update="setConfig(schema.key, $event)"
      />
    </section>

    <!-- Backend settings -->
    <section v-for="backend in backendConfigs" :key="backend.type">
      <h3>{{ backend.type }} Backend</h3>

      <select v-model="backend.selectedProvider">
        <option
          v-for="provider in backend.providers"
          :key="provider.id"
          :value="provider.id"
        >
          {{ provider.name }}
        </option>
      </select>

      <!-- Selected provider settings -->
      <ConfigField
        v-for="config in selectedProviderConfigs(backend)"
        :schema="config"
        :value="getConfig(config.key)"
        @update="setConfig(config.key, $event)"
      />
    </section>
  </div>
</template>
```

**Data Flow:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Plugin / Backend                                                            │
│                                                                             │
│  configSchema: {                                                            │
│    key: "imageGenerationBackend",                                          │
│    schema: { type: "object", ... },                                        │
│    ui: { label: "Image Generation Settings", ... }                         │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓ Collect schemas
┌─────────────────────────────────────────────────────────────────────────────┐
│  Host App Layer (MulmoChat)                                                  │
│                                                                             │
│  1. Collect configSchema from all plugins                                   │
│  2. Auto-generate settings UI from schemas                                  │
│  3. Persist settings values to localStorage                                 │
│  4. Provide values via context.app.getConfig()                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓ Auto-generate UI
┌─────────────────────────────────────────────────────────────────────────────┐
│  Settings Screen (Auto-generated)                                            │
│                                                                             │
│  ┌─────────────────────────────────────┐                                   │
│  │ Image Generation Settings            │                                   │
│  │ ┌─────────────────────────────────┐ │                                   │
│  │ │ Backend: [Gemini ▼]             │ │                                   │
│  │ │ Style: [________________]        │ │                                   │
│  │ │ Model: [gemini-2.5-flash ▼]     │ │                                   │
│  │ └─────────────────────────────────┘ │                                   │
│  └─────────────────────────────────────┘                                   │
│                                                                             │
│  ┌─────────────────────────────────────┐                                   │
│  │ Weather Settings                     │                                   │
│  │ ┌─────────────────────────────────┐ │                                   │
│  │ │ Unit: ○ Celsius ● Fahrenheit    │ │                                   │
│  │ │ Default Location: [Tokyo___]     │ │                                   │
│  │ └─────────────────────────────────┘ │                                   │
│  └─────────────────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Impact:**
- Plugin developers just declare configuration schema
- Reduced settings UI implementation effort
- Unified validation across settings
- Centralized backend configuration management
- Improved user experience (consistent settings UI)

**Design Considerations:**
- Maintain backward compatibility with existing getConfig/setConfig
- Support custom UI components (component: "custom")
- Separate management for secrets (API keys, etc.) - environment variables or encrypted storage
- Reactive updates on config changes

---

#### 6. Tool Capabilities Declaration

**Current Problem:**
- LLM cannot accurately understand tool input/output
- Difficult to select appropriate tools

**Required Features:**
```typescript
interface ToolCapabilities {
  inputTypes?: ResourceType[];   // Accepted inputs
  outputType?: ResourceType;     // Output type
  streaming?: boolean;           // Streaming support
  undoable?: boolean;            // Can be undone
  sideEffects?: boolean;         // Has side effects
}
```

**Impact:**
- Improved LLM tool selection accuracy
- Integration with resource reference system
- Host app UI optimization

---

#### 7. Undo/Redo / History Management

**Current Problem:**
- Cannot undo tool executions
- Cannot rollback state

**Required Features:**
```typescript
interface ToolResult {
  // Existing fields...

  // Addition
  undoable?: boolean;
  undo?: () => Promise<void>;
}

interface ToolContext {
  history?: {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
  };
}
```

**Impact:**
- Safe environment for experimentation
- Complex workflow management

---

#### 8. Background Tasks / Notifications

**Current Problem:**
- Plugins only run when called
- No progress display for long operations
- Cannot send proactive notifications

**Required Features:**
```typescript
interface ToolContextApp {
  // Addition
  tasks: {
    run: (task: BackgroundTask) => TaskHandle;
    cancel: (handle: TaskHandle) => void;
  };

  notifications: {
    show: (notification: Notification) => void;
    requestPermission: () => Promise<boolean>;
  };
}
```

**Impact:**
- Improved UX for long operations (video generation, etc.)
- Proactive AI assistant

---

### Priority: Low 🟢

#### 9. Permission System

**Required Features:**
```typescript
interface ToolPluginCore {
  // Addition
  permissions?: Permission[];
}

type Permission =
  | "network"       // Network access
  | "storage"       // Storage access
  | "camera"        // Camera access
  | "location"      // Location info
  | "notifications"; // Notifications
```

**Impact:**
- Improved security
- User trust
- Safe third-party plugin adoption

---

#### 10. Plugin Marketplace

**Required Features:**
- Plugin discovery/search
- Install/uninstall
- Version management/auto-update
- Reviews/ratings

**Impact:**
- Ecosystem formation
- Developer community growth

---

## Development Roadmap

### Phase 1: Foundation (Short-term)

```
┌─────────────────────────────────────────┐
│  1. Agentic Execution System             │
│     - TaskContext type definitions       │
│     - attempt_completion pattern         │
│     - Auto error correction              │
│     - Multi-task management              │
├─────────────────────────────────────────┤
│  2. Resource Reference System            │
│     - Resource type definitions          │
│     - context.resources API              │
│     - Inter-plugin demo                  │
├─────────────────────────────────────────┤
│  3. MCP Integration                      │
│     - MCP Client interface definition    │
│     - MCPWrapperPlugin / UIOnlyPlugin    │
│     - Existing MCP tool integration demo │
├─────────────────────────────────────────┤
│  4. Persistence API                      │
│     - storage API definition             │
│     - MulmoChat implementation           │
└─────────────────────────────────────────┘
```

### Phase 2: Feature Expansion (Medium-term)

```
┌─────────────────────────────────────────┐
│  5. Unified Configuration System         │
│     - ConfigSchema definition            │
│     - Auto-generated settings UI         │
│     - Backend config integration         │
├─────────────────────────────────────────┤
│  6. Capabilities declaration             │
│  7. Undo/Redo                           │
│  8. Background tasks                     │
│  9. Streaming execution                  │
└─────────────────────────────────────────┘
```

### Phase 3: Ecosystem (Long-term)

```
┌─────────────────────────────────────────┐
│  10. Permission system                   │
│  11. Plugin marketplace                  │
│  12. Expansion to other host apps        │
└─────────────────────────────────────────┘
```

---

## Design Principles

### 1. Layer Independence

Each layer can be tested and developed independently.

```
gui-chat-protocol    → Type definitions only, no implementation
Plugin (core)        → Depends only on OS layer
Plugin (vue)         → Depends on core + Vue
Host App             → Integrates all layers
```

### 2. Minimal API Principle

Keep OS layer API minimal.

```typescript
// Good: Generic and minimal
context.resources.getById(uuid)

// Bad: Specialized for specific use case
context.getLastGeneratedImage()
```

### 3. Declarative Interface

Plugins declare "what they can do" and leave "how to do it" to the host app.

```typescript
// Plugin side
capabilities: {
  outputType: "image",
  inputTypes: ["image", "text"],
}

// Host app provides appropriate UI/routing
```

### 4. Backward Compatibility

Add new features as optional, don't break existing plugins.

```typescript
interface ToolContext {
  currentResult?: ToolResult;    // Existing
  app?: ToolContextApp;          // Existing
  resources?: ResourceManager;   // New (Optional)
}
```

### 5. Framework Agnostic

OS layer (gui-chat-protocol) does not depend on UI frameworks.

```
gui-chat-protocol/
├── index.ts    # Core (framework agnostic)
├── vue.ts      # Vue bindings
└── react.ts    # React bindings
```

---

## Portability

### Goal

Plugin core parts work on host apps other than MulmoChat.

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   MulmoChat     │  │   Future App A  │  │   Future App B  │
│   (Vue)         │  │   (React)       │  │   (CLI)         │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ gui-chat-protocol (shared)                                 │
├─────────────────────────────────────────────────────────────┤
│ Plugin Core (shared)                                        │
└─────────────────────────────────────────────────────────────┘
```

### Requirements for Portability

1. **gui-chat-protocol Standardization**
   - API stabilization
   - Versioning policy
   - Documentation

2. **Host App Implementation Guide**
   - context.app implementation requirements
   - UI component requirements
   - Test suite

3. **Plugin Certification**
   - Compatibility testing
   - Certification badge

---

## Next Steps

1. **Detailed Agentic Execution System Design**
   - TaskContext / TaskManager API design
   - attempt_completion pattern implementation
   - Error handling strategy

2. **Detailed Resource Reference System Design**
   - Resource type definitions
   - context.resources API
   - Existing plugin adaptation

3. **Detailed MCP Integration Design**
   - context.app.mcp API design
   - MCPWrapperPlugin / UIOnlyPlugin type definitions
   - MCP server connection management

4. **Prototype Implementation**
   - Multi-step task auto-execution demo
   - Image generation → Image editing pipeline
   - Existing MCP tool + UI plugin demo
   - Auto error correction demo

5. **Developer Feedback**
   - API design review
   - Use case collection

---

## GUI Chat Protocol Correspondence

This vision document is an extension of [GUI Chat Protocol](../GUI_CHAT_PROTOCOL.md).

### Terminology Mapping

| GUI Chat Protocol | Current Implementation | Description |
|-------------------|----------------------|-------------|
| `llmResponse` | `result.message` | Text returned to LLM |
| `guiData` | `result.data` | Data for UI display |
| `guiData.type` | `toolName` | Which component to render |
| `instructions` | `result.instructions` | Additional instructions to LLM |
| Role | systemPrompt + enabledPlugins | Tool selection + system prompt |
| Tool | Plugin | Function callable by LLM |

### GUI Chat Protocol Core Concepts

**Enhanced Tool Calls:**
```
Tool executes → Response to LLM + GUI data
            → LLM continues conversation
            → UI renders appropriate component
```

**Roles:**
```typescript
// Role = Available tools + System prompt
interface Role {
  name: string;
  tools: string[];      // Enabled plugins
  systemPrompt: string; // Behavioral instructions
}

// Example: Recipe Guide role
const recipeGuide: Role = {
  name: "recipeGuide",
  tools: ["presentForm", "presentDocument", "generateImage", "browse"],
  systemPrompt: "You are a cooking instructor who guides users..."
};
```

**Dynamic Role Switching:**
```typescript
// LLM calls switchRole to change roles
switchRole({ role: "recipeGuide" });  // Cooking guide mode
switchRole({ role: "tutor" });        // Tutor mode
switchRole({ role: "tripPlanner" });  // Trip planner mode
```

### Features Added in This Document

Building on GUI Chat Protocol's foundation, this document adds:

1. **Agentic Execution** - Auto-loop via attempt_completion pattern
2. **Resource Reference System** - Data sharing between tool results
3. **MCP Integration** - Leveraging existing MCP ecosystem
4. **Task Context Management** - Parallel management of multiple tasks
5. **Tool Interface Specification** - RFC-like standardization

These are concrete implementation directions to realize GUI Chat Protocol's "Chat-Centric OS" vision.

---

## Related Documents

- [GUI Chat Protocol](../GUI_CHAT_PROTOCOL.md) - Foundation protocol specification
- [Plugin Architecture](./plugin-architecture.md)
- [Plugin Development Guide](./plugin-development-guide.md)
- [Plugin Extraction Guide](./plugin-extraction-guide.md)
