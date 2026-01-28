# Tool Plugin Developer Guide

This guide explains how to create new tool plugins for MulmoChat. Tool plugins extend the application's capabilities by adding new AI-powered functionality that can be invoked during conversations.

## Table of Contents

- [Key Innovation](#key-innovation)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Plugin Interface](#plugin-interface)
- [Creating a Basic Plugin](#creating-a-basic-plugin)
- [Adding UI Components](#adding-ui-components)
- [Plugin Configuration](#plugin-configuration)
- [File Upload Support](#file-upload-support)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Testing Your Plugin](#testing-your-plugin)

## Key Innovation

**MulmoChat extends OpenAI's function calling mechanism to enable direct GUI communication between plugins and users.**

Traditional function calling systems follow this pattern:
```
User → AI → Function Call → Backend → JSON Response → AI → User
```

MulmoChat's innovation adds a **visual layer** to this flow:
```
User → AI → Function Call → Plugin Execution → Rich GUI Result → User
                    ↓
                AI receives JSON summary for context
```

**What this means:**
- **Dual Output:** Each plugin returns both machine-readable data (for the AI) and human-readable UI (for the user)
- **Rich Interactions:** Users see images, maps, interactive games, videos—not just text
- **Persistent Results:** Plugin outputs remain visible in the sidebar and can be re-selected
- **Visual Context:** The AI knows what the user is seeing and can reference it naturally
- **Bidirectional Communication:** Users can interact with plugin UIs while conversing with the AI

**Example:** When the AI calls `generateImage("sunset over mountains")`:
1. Plugin generates the image
2. **User sees:** Full-resolution image rendered on canvas
3. **AI receives:** `"Image generated successfully and displayed to user"`
4. Conversation continues with both parties aware of the visual context

This architecture transforms function calling from a backend integration pattern into a **multimodal user experience**.

## Architecture Overview

The plugin system is designed to be modular and self-contained. All plugin-specific code lives in `src/tools/` and follows a consistent pattern:

```
src/tools/
├── types.ts                    # Core interfaces
├── index.ts                    # Plugin registry
├── models/                     # Plugin implementations
│   └── yourPlugin.ts
├── views/                      # Full-screen view components
│   └── yourPlugin.vue
├── previews/                   # Sidebar preview components
│   └── yourPlugin.vue
└── configs/                    # Configuration UI components
    └── YourPluginConfig.vue
```

**Key Principles:**
- **Multimodal Function Calling:** Plugins provide both visual output and AI context
- **Self-contained:** Each plugin defines its own behavior, UI, and configuration
- **No core changes:** Adding a plugin doesn't require modifying App.vue or composables
- **Type-safe:** Full TypeScript support with interfaces
- **Reactive:** Integrates seamlessly with Vue 3's reactivity system

## Quick Start

### 1. Create the Plugin File

Create a new file in `src/tools/models/yourPlugin.ts`:

```typescript
import { ToolPlugin, ToolContext, ToolResult } from "../types";

const toolName = "yourPlugin";

// Define the tool for OpenAI function calling
const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Description of what your plugin does",
  parameters: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The user's query",
      },
    },
    required: ["query"],
  },
};

// Define your plugin's data structure
export interface YourPluginData {
  result: string;
  // Add other fields as needed
}

// Implement the plugin execution logic
const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<YourPluginData>> => {
  const query = args.query as string;

  // Your plugin logic here
  const result = await doSomething(query);

  return {
    data: { result },
    message: "Success message sent back to the AI",
    instructions: "Optional follow-up instructions for the AI",
  };
};

// Export the plugin
export const plugin: ToolPlugin<YourPluginData> = {
  toolDefinition,
  execute,
  generatingMessage: "Processing...",
  isEnabled: () => true,
};
```

### 2. Register the Plugin

Add your plugin to `src/tools/index.ts`:

```typescript
import { plugin as yourPlugin } from "./models/yourPlugin";

const pluginList = [
  // ... existing plugins
  { name: "yourPlugin", plugin: yourPlugin },
];
```

### 3. Test It

Start the dev server and ask the AI to use your plugin:

```bash
npm run dev
```

## Plugin Interface

### ToolPlugin Interface

Located in `src/tools/types.ts:41-68`:

```typescript
export interface ToolPlugin<T = Record<string, any>, J = any> {
  // Required: OpenAI function definition
  toolDefinition: {
    type: "function";
    name: string;
    description: string;
    parameters?: {
      type: "object";
      properties: {
        [key: string]: any;
      };
      required: string[];
    };
  };

  // Required: Execution function
  execute: (
    context: ToolContext,
    args: Record<string, any>,
  ) => Promise<ToolResult<T, J>>;

  // Required: Message shown during execution
  generatingMessage: string;

  // Required: Enable/disable the plugin based on server capabilities
  isEnabled: (startResponse?: StartApiResponse) => boolean;

  // Optional: Message shown while waiting for preconditions
  waitingMessage?: string;

  // Optional: Message shown during file upload
  uploadMessage?: string;

  // Optional: Delay in ms after execution before next action
  delayAfterExecution?: number;

  // Optional: Vue component for full-screen view
  viewComponent?: any;

  // Optional: Vue component for sidebar preview
  previewComponent?: any;

  // Optional: File upload configuration
  fileUpload?: FileUploadConfig;

  // Optional: System prompt statement for this tool
  systemPrompt?: string;

  // Optional: Plugin-specific configuration UI
  config?: ToolPluginConfig;
}
```

### ToolContext Interface

Located in `src/tools/types.ts:4-8`:

```typescript
export interface ToolContext {
  // Previous result if plugin is updating existing result
  currentResult: ToolResult<any> | null;

  // User preferences (language, system prompt, etc.)
  userPreferences?: UserPreferencesState;

  // Helper to get plugin config values
  getPluginConfig?: <T = any>(key: string) => T | undefined;
}
```

### ToolResult Interface

**This is where the dual-output innovation happens.**

Located in `src/tools/types.ts:10-22`:

```typescript
export interface ToolResult<T = Record<string, any>, J = any> {
  // Auto-assigned by system
  toolName?: string;
  uuid?: string;

  // ==========================================
  // AI Communication (Function Calling Output)
  // ==========================================

  // Required: Status message sent back to the AI
  // This is what the AI "hears" about the operation
  message: string;

  // Optional: Data sent to the AI as JSON
  // Structured data the AI can reason about
  jsonData?: J;

  // Optional: Follow-up instructions for the AI
  // Guide the AI's next response
  instructions?: string;

  // Optional: If true, instructions sent even if user disabled them
  instructionsRequired?: boolean;

  // ==========================================
  // User Communication (GUI Output)
  // ==========================================

  // Optional: Plugin-specific data for UI rendering
  // This is what the user SEES (images, maps, interactive content)
  data?: T;

  // Optional: Display title (defaults to tool name)
  // Shown in sidebar preview
  title?: string;

  // Optional: Plugin-specific view state
  // Manages interactive UI state
  viewState?: Record<string, any>;

  // ==========================================
  // System Behavior
  // ==========================================

  // Optional: If true, updates existing result instead of creating new one
  updating?: boolean;
}
```

**Key Concept:** The `message` and `jsonData` fields inform the AI, while the `data` field (rendered by your view component) informs the user visually.

## Creating a Basic Plugin

Let's create a weather plugin as an example:

### Step 1: Define the Plugin

**File:** `src/tools/models/weather.ts`

```typescript
import { ToolPlugin, ToolContext, ToolResult } from "../types";

const toolName = "weather";

export interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Get current weather information for a city",
  parameters: {
    type: "object" as const,
    properties: {
      city: {
        type: "string",
        description: "The city name",
      },
    },
    required: ["city"],
  },
};

const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<WeatherData>> => {
  const city = args.city as string;

  try {
    // Call weather API (example)
    const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    const data = await response.json();

    return {
      // ==========================================
      // GUI Output - What the USER sees
      // ==========================================
      data: {
        city: data.city,
        temperature: data.temp,
        condition: data.condition,
        humidity: data.humidity,
      },
      // This data will be rendered by your view component
      // User sees: Beautiful weather visualization on canvas

      // ==========================================
      // Function Calling Output - What the AI receives
      // ==========================================
      message: `Weather for ${city}: ${data.temp}°C, ${data.condition}`,
      // AI receives: "Weather for Tokyo: 22°C, Sunny"

      instructions: "Describe the weather to the user in a natural way",
      // AI knows: "The user can already SEE the weather widget,
      //            so I should conversationally reference it"
    };
  } catch (error) {
    return {
      message: `Failed to get weather for ${city}`,
      instructions: "Apologize and suggest trying another city",
    };
  }
};

export const plugin: ToolPlugin<WeatherData> = {
  toolDefinition,
  execute,
  generatingMessage: "Checking weather...",
  isEnabled: () => true,
  systemPrompt: "When users ask about weather, use the weather tool to get current conditions.",
};
```

### Step 2: Register the Plugin

**File:** `src/tools/index.ts`

```typescript
import { plugin as weather } from "./models/weather";

const pluginList = [
  // ... existing plugins
  { name: "weather", plugin: weather },
];
```

That's it! Your basic plugin is ready.

### Understanding the Dual-Output Flow

Here's what happens when the AI calls your plugin:

```
User: "What's the weather in Tokyo?"
  ↓
AI: Calls weather({ city: "Tokyo" })
  ↓
Plugin executes and returns:
  {
    data: { city: "Tokyo", temp: 22, ... },     ← Rendered as GUI
    message: "Weather for Tokyo: 22°C, Sunny",  ← Sent to AI
    instructions: "Describe naturally"          ← Sent to AI
  }
  ↓
User sees: Beautiful weather widget on canvas
AI receives: "Weather for Tokyo: 22°C, Sunny"
  ↓
AI responds: "I can see Tokyo is enjoying lovely weather at 22°C with sunny skies!"
```

**Real-World Examples from MulmoChat:**

| Plugin | User Sees (GUI) | AI Receives (Message) |
|--------|-----------------|----------------------|
| `generateImage` | Full-resolution image on canvas | "Image generated and displayed" |
| `map` | Interactive Google Map | "Map showing [location] displayed to user" |
| `browse` | Rendered webpage content | "Webpage content: [summary]" |
| `othello` | Interactive game board | "Game board updated, it's [player]'s turn" |
| `quiz` | Quiz interface with questions | "Quiz question displayed: [question]" |

This pattern allows the AI to maintain conversational context while users enjoy rich visual experiences.

## Adding UI Components

**This is where you define what the user actually SEES.**

### Preview Component (Sidebar)

Create a preview component for the sidebar thumbnail:

**File:** `src/tools/previews/weather.vue`

```vue
<template>
  <div class="text-sm">
    <div class="font-semibold">{{ result.data?.city }}</div>
    <div class="text-gray-600">
      {{ result.data?.temperature }}°C - {{ result.data?.condition }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import type { WeatherData } from "../models/weather";

defineProps<{
  result: ToolResult<WeatherData>;
}>();
</script>
```

### View Component (Full Screen)

Create a full-screen view component:

**File:** `src/tools/views/weather.vue`

```vue
<template>
  <div class="h-full flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-600">
    <div class="text-white text-center">
      <h1 class="text-6xl font-bold mb-4">{{ selectedResult.data?.city }}</h1>
      <div class="text-8xl mb-4">{{ selectedResult.data?.temperature }}°C</div>
      <div class="text-3xl mb-8">{{ selectedResult.data?.condition }}</div>
      <div class="text-xl">Humidity: {{ selectedResult.data?.humidity }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import type { WeatherData } from "../models/weather";

defineProps<{
  selectedResult: ToolResult<WeatherData>;
}>();
</script>
```

### Register Components

Update your plugin to include the components:

```typescript
import WeatherView from "../views/weather.vue";
import WeatherPreview from "../previews/weather.vue";

export const plugin: ToolPlugin<WeatherData> = {
  toolDefinition,
  execute,
  generatingMessage: "Checking weather...",
  isEnabled: () => true,
  viewComponent: WeatherView,
  previewComponent: WeatherPreview,
  systemPrompt: "When users ask about weather, use the weather tool.",
};
```

## Plugin Configuration

Add user-configurable settings to your plugin.

### Step 1: Create Config Component

**File:** `src/tools/configs/WeatherConfig.vue`

```vue
<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Temperature Unit
    </label>
    <select
      :value="value"
      @change="$emit('update:value', ($event.target as HTMLSelectElement).value)"
      class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="celsius">Celsius (°C)</option>
      <option value="fahrenheit">Fahrenheit (°F)</option>
    </select>
    <p class="text-xs text-gray-500 mt-1">
      Choose your preferred temperature unit.
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: "celsius" | "fahrenheit" }>();
defineEmits<{ "update:value": [value: "celsius" | "fahrenheit"] }>();
</script>
```

**Requirements:**
- Props: `{ value: any }` - Current config value
- Emits: `{ 'update:value': [newValue: any] }` - Value change events

### Step 2: Add Config to Plugin

```typescript
import WeatherConfig from "../configs/WeatherConfig.vue";

export const plugin: ToolPlugin<WeatherData> = {
  // ... other properties
  config: {
    key: "weatherUnit",              // Storage key
    defaultValue: "celsius",          // Default value
    component: WeatherConfig,         // Vue component
  },
};
```

### Step 3: Use Config in Execution

```typescript
const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<WeatherData>> => {
  const city = args.city as string;

  // Get user's configured temperature unit
  const unit = context.getPluginConfig?.("weatherUnit") || "celsius";

  const response = await fetch(
    `/api/weather?city=${encodeURIComponent(city)}&unit=${unit}`
  );

  // ... rest of implementation
};
```

**Storage:**
- Configs are automatically saved to `localStorage` under key `plugin_configs_v1`
- The value is accessible via `context.getPluginConfig(key)`
- The UI is automatically rendered in the settings modal

## File Upload Support

Allow users to upload files that your plugin processes.

### Step 1: Define File Handler

```typescript
import type { FileUploadConfig } from "../types";

export function createUploadedWeatherImageResult(
  imageData: string,
  fileName: string,
): ToolResult<WeatherImageData> {
  return {
    toolName: "weather",
    data: { imageData, fileName },
    message: "Weather image uploaded",
    title: fileName,
  };
}
```

### Step 2: Add to Plugin

```typescript
export const plugin: ToolPlugin<WeatherData> = {
  // ... other properties
  fileUpload: {
    acceptedTypes: ["image/png", "image/jpeg"],
    handleUpload: createUploadedWeatherImageResult,
  },
};
```

**File Upload Flow:**
1. User clicks upload button in sidebar
2. System filters files by `acceptedTypes`
3. Files are read as base64 data URLs
4. `handleUpload` creates a `ToolResult` for each file
5. Results are added to the sidebar and can be selected

## Advanced Features

### Updating Existing Results

Set `updating: true` to modify an existing result instead of creating a new one:

```typescript
const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<WeatherData>> => {
  // ... fetch new data

  return {
    data: newWeatherData,
    message: "Weather updated",
    updating: true,  // Updates existing result
  };
};
```

### Conditional Instructions

Control when instructions are sent to the AI:

```typescript
return {
  data: result,
  message: "Success",
  instructions: "Describe the result to the user",
  instructionsRequired: true,  // Send even if user disabled instructions
};
```

### Custom Generation Messages

Show different messages during execution:

```typescript
export const plugin: ToolPlugin = {
  // ... other properties
  generatingMessage: "Fetching weather data...",
  waitingMessage: "Waiting for location access...",
  uploadMessage: "Processing weather image...",
};
```

### Execution Delays

Add a delay after execution (useful for rate limiting):

```typescript
export const plugin: ToolPlugin = {
  // ... other properties
  delayAfterExecution: 2000,  // 2 second delay
};
```

### Conditional Enabling

Enable plugins based on server capabilities:

```typescript
import type { StartApiResponse } from "../../server/types";

export const plugin: ToolPlugin = {
  // ... other properties
  isEnabled: (startResponse?: StartApiResponse) => {
    // Only enable if Google Maps key is available
    return !!startResponse?.googleMapKey;
  },
};
```

### System Prompts

Guide the AI on when to use your plugin:

```typescript
export const plugin: ToolPlugin = {
  // ... other properties
  systemPrompt:
    "When users ask about weather, current conditions, or temperature, " +
    "you MUST use the weather tool to provide accurate information.",
};
```

**System Prompt Best Practices:**
- Be specific about when to use the tool
- Use "MUST" for required usage
- Include examples of user queries that should trigger the tool
- Keep it concise (1-2 sentences)

### View State Management

Store and update view-specific state:

```typescript
// In execute function
return {
  data: weatherData,
  viewState: {
    selectedTab: "forecast",
    zoomLevel: 10,
  },
};

// In view component
const updateViewState = (newState: Record<string, any>) => {
  emit("update-result", {
    ...props.selectedResult,
    viewState: { ...props.selectedResult.viewState, ...newState },
  });
};
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<WeatherData>> => {
  try {
    const result = await fetchData(args);
    return {
      data: result,
      message: "Success",
    };
  } catch (error) {
    console.error("Plugin error:", error);
    return {
      message: "Operation failed",
      instructions: "Apologize to the user and suggest an alternative",
    };
  }
};
```

### 2. Type Safety

Define clear interfaces for your data:

```typescript
export interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
}

export const plugin: ToolPlugin<WeatherData> = {
  // TypeScript will enforce the data structure
};
```

### 3. Validate Arguments

Check and validate all function arguments:

```typescript
const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<WeatherData>> => {
  const city = args.city as string;

  if (!city || city.trim().length === 0) {
    return {
      message: "City name is required",
      instructions: "Ask the user for a city name",
    };
  }

  // ... continue execution
};
```

### 4. Keep Plugins Self-Contained

- Don't modify `App.vue` or composables
- Keep all logic within the plugin file
- Use the provided interfaces and context
- Don't access global state directly

### 5. Design for Dual-Output

**Always think about both audiences:**

```typescript
// ❌ Bad: Only considers the AI
return {
  message: "Operation completed successfully",
};

// ✅ Good: Provides rich GUI + clear AI feedback
return {
  // User sees beautiful visualization
  data: {
    chart: chartData,
    metrics: detailedMetrics,
    visualization: svg,
  },
  // AI understands what happened
  message: "Generated sales chart showing 23% growth in Q4",
  // AI knows how to respond naturally
  instructions: "Reference the chart the user is seeing and highlight key insights",
};
```

**Key guidelines:**
- The `message` should be concise but informative for the AI
- The `data` should be complete and render beautifully
- The `instructions` should acknowledge that the user can SEE the result
- Think: "What does the AI need to know?" vs "What does the user need to see?"

### 6. Provide Clear Feedback

- Use descriptive `generatingMessage` text
- Provide helpful `instructions` for the AI
- Include user-friendly error messages
- Add titles to results for clarity

### 7. Optimize Performance

- Cache repeated API calls when appropriate
- Use `delayAfterExecution` for rate-limited APIs
- Lazy-load heavy dependencies
- Keep UI components lightweight

### 8. Configuration Guidelines

- Use sensible defaults
- Provide clear labels and descriptions
- Validate configuration values
- Support backward compatibility with fallbacks

## Testing Your Plugin

### Manual Testing Checklist

1. **Basic Functionality**
   - [ ] Plugin executes without errors
   - [ ] Correct data is returned
   - [ ] Results appear in sidebar
   - [ ] Full view renders correctly

2. **Error Handling**
   - [ ] Invalid arguments handled gracefully
   - [ ] Network errors don't crash the app
   - [ ] Error messages are user-friendly

3. **UI Components**
   - [ ] Preview component renders in sidebar
   - [ ] View component fills full screen
   - [ ] Components handle missing data
   - [ ] Styling is consistent with app

4. **Configuration**
   - [ ] Config UI appears in settings
   - [ ] Changes are saved to localStorage
   - [ ] Config values are used correctly
   - [ ] Default values work as expected

5. **Integration**
   - [ ] AI understands when to use the tool
   - [ ] System prompt guides AI appropriately
   - [ ] Instructions result in natural responses
   - [ ] Multiple invocations work correctly

### Testing in Development

```bash
# Start dev server
npm run dev

# Test scenarios:
# 1. Ask AI to trigger your plugin
# 2. Upload files (if supported)
# 3. Change configuration settings
# 4. Test error cases
# 5. Test with multiple results
```

### Example Test Conversations

**For Weather Plugin:**
- "What's the weather in Tokyo?"
- "How's the weather?" (should ask for location)
- "Compare weather in London and Paris"
- Upload a weather map image

## Common Patterns

### Pattern 1: API Integration

```typescript
const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<DataType>> => {
  const response = await fetch("/api/your-endpoint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    data: data,
    message: "Success message for AI",
  };
};
```

### Pattern 2: Multi-Step Operations

```typescript
const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<DataType>> => {
  // Step 1: Prepare
  const prepared = await prepare(args);

  // Step 2: Process
  const processed = await process(prepared);

  // Step 3: Finalize
  const result = await finalize(processed);

  return {
    data: result,
    message: "Completed multi-step operation",
  };
};
```

### Pattern 3: Conditional Logic

```typescript
const execute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<DataType>> => {
  const mode = context.getPluginConfig?.("mode") || "default";

  if (mode === "advanced") {
    return await advancedExecution(context, args);
  } else {
    return await simpleExecution(context, args);
  }
};
```

## Key Takeaways

**MulmoChat's plugin architecture extends OpenAI's function calling with visual communication:**

1. **Traditional Function Calling:**
   - AI calls function → Gets JSON → Describes result to user
   - User only hears about the result through text

2. **MulmoChat's Multimodal Function Calling:**
   - AI calls plugin → User sees rich GUI + AI gets context
   - User experiences the result directly through visualization
   - AI references what the user is seeing

**This creates a fundamentally different interaction model:**
- Users can explore results visually (maps, images, games) while conversing
- The AI maintains awareness of the visual context
- Function calls become UI events, not just data transformations
- Multimodal experiences emerge from standard function calling

**When building plugins, remember:**
- You're not just processing data—you're creating user experiences
- The `data` field is as important as the `message` field
- Always design for both the AI's understanding and the user's visual experience
- The GUI is not an afterthought—it's the primary innovation

## Next Steps

1. Review existing plugins in `src/tools/models/` for more examples:
   - `generateImage.ts` - Image generation with visual output
   - `map.ts` - Interactive Google Maps integration
   - `othello.ts` - Stateful interactive game
   - `browse.ts` - Web content rendering

2. Check out the plugin types in `src/tools/types.ts`
3. Read the main project documentation in `CLAUDE.md`
4. Explore the composables in `src/composables/` to understand the system

## Need Help?

- Review existing plugins: `generateImage.ts`, `browse.ts`, `map.ts`, `othello.ts`
- Check the TypeScript types for detailed interface documentation
- Test your plugin thoroughly before deploying
- Follow the architecture principles outlined in `CLAUDE.md`
- Study how `ToolResult` separates AI communication from GUI rendering

**Remember:** You're building the future of AI-native interfaces where visual experiences and language understanding converge seamlessly.

Happy plugin development!
