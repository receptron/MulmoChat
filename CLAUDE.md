# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vue 3 application called "MulmoChat" that provides a multi-modal voice chat interface with OpenAI's GPT-4 Realtime API. The application features a comprehensive plugin system with various AI-powered tools including image generation, web browsing, search, mapping, and interactive games.

## Philosophy

MulmoChat is a reference implementation of **[gui-chat-protocol](https://github.com/receptron/gui-chat-protocol)**.

gui-chat-protocol defines a standard interface for creating visual, interactive tool plugins that work with LLM chat applications. Key concepts:

- **ToolDefinition**: JSON Schema format for LLM function calling
- **ToolResult**: Standardized result format with `data`, `jsonData`, `instructions`, etc.
- **ViewComponent / PreviewComponent**: UI components for displaying tool results
- **Framework agnostic core**: Business logic separated from Vue/React UI

By implementing gui-chat-protocol, MulmoChat enables:
- **Plugin interoperability**: Plugins can be shared across different chat applications
- **Framework flexibility**: Plugins can be written in Vue, React, or other frameworks
- **LLM agnostic**: Works with any LLM that supports function calling (OpenAI, Anthropic, Google, etc.)

GUIChatPluginTemplate provides a starting point for creating new plugins that follow this protocol.

## Key Commands

- **Development server**: `npm run dev` (runs both client and server concurrently)
- **Client only**: `npm run dev:client`
- **Server only**: `npm run dev:server` or `npm run server`
- **Lint**: `npm run lint`
- **Format code**: `npm run format`

**IMPORTANT**: Do NOT run build commands (`npm run build`, `npm run build:server`, `npm run preview`, `npm run start`) as they create unnecessary build artifacts.

## Architecture

### Core Components

- **App.vue** (src/App.vue): Main application component that orchestrates the UI and coordinates between composables. Handles routing between sidebar and main canvas view components based on selected tool results.
- **Sidebar.vue** (src/components/Sidebar.vue): Left panel with voice controls, tool results display, and text input
- **GoogleMap.vue** (src/components/GoogleMap.vue): Google Maps integration component

### Composables Architecture

The application uses Vue 3 composables to separate concerns and manage complex state:

#### useRealtimeSession (src/composables/useRealtimeSession.ts)
Manages WebRTC connection and OpenAI Realtime API communication:
- **WebRTC Management**: Creates RTCPeerConnection, data channels, and manages audio streams
- **Session Lifecycle**: Start/stop chat, connection state tracking
- **Message Handling**: Processes incoming messages (tool calls, text deltas, speech events)
- **Audio Control**: Mute/unmute, local audio enable/disable
- **Event System**: Registers event handlers for tool calls, text updates, conversation events, and speech detection
- **Data Channel Communication**: Sends user messages, function call outputs, and instructions

Key features:
- Ephemeral key management via `/api/start` endpoint
- Bidirectional audio streaming with getUserMedia
- Function call argument accumulation and deduplication
- Conversation state tracking (active/inactive)
- Speech start/stop detection for listener mode

#### useToolResults (src/composables/useToolResults.ts)
Manages plugin/tool execution and results state:
- **Result Management**: Maintains array of tool execution results with selection state
- **Tool Execution**: Handles incoming tool calls from OpenAI, executes plugins with context
- **Result Updates**: Updates existing results vs. adding new ones based on plugin's `updating` flag
- **Instructions**: Conditionally sends follow-up instructions based on plugin configuration and user preferences
- **File Uploads**: Processes uploaded files as tool results
- **UI Coordination**: Triggers sidebar scrolling and canvas updates

Key features:
- Tool result selection and updates
- Generation status tracking with custom messages per plugin
- Instruction suppression logic (respects `instructionsRequired` flag)
- Plugin delay handling after execution
- Context passing (e.g., current result for updates)

#### useUserPreferences (src/composables/useUserPreferences.ts)
Manages user settings and preferences with localStorage persistence:
- **Preference State**: User language, system prompt ID, custom instructions, suppress instructions flag, enabled plugins
- **localStorage Sync**: Automatically persists all preferences to localStorage with watchers
- **Instruction Building**: Constructs final system prompt from base prompt + plugin prompts + custom instructions + language
- **Tool Building**: Filters enabled tools based on plugin preferences

Storage keys:
- `user_language_v1`: User's native language code
- `suppress_instructions_v1`: Whether to suppress plugin follow-up instructions
- `system_prompt_id_v1`: Selected system prompt (e.g., "default", "listener")
- `enabled_plugins_v1`: JSON object of plugin enable/disable state
- `custom_instructions_v1`: User's custom instructions text

### Server Architecture

- **Express.js server** (server/index.ts): Handles API endpoints and serves the client
- **API routes** (server/routes/api.ts): REST endpoints for starting sessions, Twitter embeds, and search
- **Types** (server/types.ts): TypeScript interfaces for API responses

### Plugin System

The application implements a comprehensive plugin architecture located in `src/tools/`:

**IMPORTANT**: Keep all plugin-specific code out of App.vue and composables. The plugin system is designed to be modular and self-contained:
- **App.vue**: Only orchestrates UI and coordinates between composables using the centralized plugin interface (`toolExecute`, `getToolPlugin`)
- **Composables**: Handle generic concerns (WebRTC, results management, preferences) without plugin-specific logic
- **Plugin system**: All plugin-specific behavior lives in `src/tools/`

#### Core Plugin Interface (src/tools/type.ts)
- **ToolPlugin**: Defines plugin structure with tool definition, execute function, and metadata
- **ToolResult**: Standardized result format for all plugins
- **ToolContext**: Provides context like images to plugin execution

#### Available Plugins
1. **generateImage** (src/tools/generateImage.ts): Google Gemini image generation
2. **editImage** (src/tools/editImage.ts): Image editing capabilities
3. **browse** (src/tools/browse.ts): Web browsing and content extraction
4. **exa** (src/tools/exa.ts): AI-powered search using Exa API
5. **map** (src/tools/map.ts): Google Maps location and directions
6. **mulmocast** (src/tools/mulmocast.ts): Podcast/audio content integration
7. **music** (src/tools/music.ts): Music playback and control
8. **othello** (src/tools/othello.ts): Interactive Othello game with AI
9. **quiz** (src/tools/quiz.ts): Interactive quiz functionality
10. **markdown** (src/tools/markdown.ts): Markdown processing and rendering
11. **canvas** (src/tools/canvas.ts): Canvas drawing and manipulation

#### Plugin Components and Previews
Each plugin has associated Vue components:
- **Components** (src/tools/views/): Full-view components for displaying tool results
- **Previews** (src/tools/previews/): Sidebar thumbnail previews of tool results

### Key Integration Points

The application integrates multiple AI services and APIs:
1. **OpenAI Realtime API**: Voice chat with WebRTC and function calling
2. **Google Gemini**: Image generation and editing
3. **Exa API**: AI-powered web search
4. **Google Maps API**: Location services and mapping
5. **Twitter API**: Tweet embedding (server-side)

### State Management

State is now distributed across composables rather than centralized:
- **User Preferences** (useUserPreferences): System prompt, language, custom instructions, plugin settings - persisted to localStorage
- **Session State** (useRealtimeSession): WebRTC connection, audio streams, data channels, mute state, conversation active status
- **Tool Results** (useToolResults): Array of plugin execution results, selected result, generation status
- **App-level State** (App.vue): User input text, messages array, current text accumulation

### Data Flow

#### Session Initialization Flow
1. User clicks start chat in Sidebar
2. App.vue calls `startChat()` which invokes `useRealtimeSession.startChat()`
3. `useRealtimeSession` fetches ephemeral key from `/api/start` endpoint
4. Creates RTCPeerConnection with data channel named "oai-events"
5. Requests microphone access via getUserMedia
6. Creates WebRTC offer and exchanges SDP with OpenAI's realtime endpoint
7. On data channel open, sends `session.update` with instructions (from useUserPreferences) and tools

#### Message Flow (WebRTC → Tool Execution)
1. OpenAI sends message through WebRTC data channel
2. `useRealtimeSession` receives message in `handleMessage` handler
3. Different message types trigger different handlers:
   - `response.function_call_arguments.delta`: Accumulates function arguments
   - `response.function_call_arguments.done`: Calls registered `onToolCall` handler
   - `response.text.delta`: Calls `onTextDelta` for streaming text
   - `response.created`/`response.done`: Updates conversation active state
   - `input_audio_buffer.speech_started/stopped`: Triggers speech event handlers
4. App.vue's registered `onToolCall` handler forwards to `useToolResults.handleToolCall()`
5. `useToolResults` executes the plugin via `toolExecute(context, toolName, args)`
6. Result is added to `toolResults` array (or updates existing if `result.updating === true`)
7. Result displayed in sidebar preview and selected for main canvas
8. Function output sent back to OpenAI via `sendFunctionCallOutput()`
9. Optional follow-up instructions sent via `sendInstructions()` if plugin defines them

#### User Text Message Flow
1. User types in sidebar text input and presses send
2. Sidebar emits `send-text-message` event
3. App.vue's `sendTextMessage()` waits for conversation to be inactive (max 5 seconds)
4. Calls `useRealtimeSession.sendUserMessage(text)`
5. Sends two data channel messages:
   - `conversation.item.create` with user message content
   - `response.create` to trigger model response

#### Listener Mode Flow (Special System Prompt)
When `systemPromptId === "listener"`:
1. Speech starts → Updates `lastSpeechStartedTime`
2. Speech stops → Checks if speech duration exceeded threshold (15 seconds)
3. If threshold exceeded:
   - Disables local audio via `setLocalAudioEnabled(false)`
   - Waits for audio gap (2 seconds)
   - Re-enables audio based on current mute state
   - Resets speech start timer

## Mulmocast NPM Package API

### Overview

The mulmocast npm package provides programmatic TypeScript/JavaScript API to create movies from MulmoScript. It exports both Node.js and browser-compatible modules with full TypeScript type definitions.

### Installation

```bash
yarn add mulmocast
```

**Requirements**: Node.js >= 20.0.0, FFmpeg installed on system

### Main Entry Points

```typescript
// Node.js import
import { movie, movieFilePath } from 'mulmocast';
import type { MulmoStudioContext, MulmoCanvasDimension, BeatMediaType, MulmoFillOption } from 'mulmocast';

// Package exports:
// - Node: "./lib/index.node.js" (types: "./lib/index.node.d.ts")
// - Browser: "./lib/index.browser.js" (types: "./lib/index.browser.d.ts")
```

### Key Function: `movie()`

The primary function to create a movie from MulmoScript:

```typescript
function movie(context: MulmoStudioContext): Promise<void>
```

**Parameters:**
- `context: MulmoStudioContext` - Studio context object containing:
  - The MulmoScript data (JSON/YAML format with beats)
  - Audio files for each beat
  - Image files for visual content
  - Canvas dimensions and layout settings
  - Output file path and settings
  - Localization options (language, captions)

**Returns:** `Promise<void>` - Resolves when the video MP4 file is created

### Supporting Functions

1. **`movieFilePath(context: MulmoStudioContext): string`**
   ```typescript
   function movieFilePath(context: MulmoStudioContext): string
   ```
   - Generates the output video file path based on the context
   - Returns the full path where the video will be saved

2. **`getVideoPart(inputIndex: number, mediaType: BeatMediaType, duration: number, canvasInfo: MulmoCanvasDimension, fillOption: MulmoFillOption, speed: number)`**
   ```typescript
   function getVideoPart(
     inputIndex: number,
     mediaType: BeatMediaType,
     duration: number,
     canvasInfo: MulmoCanvasDimension,
     fillOption: MulmoFillOption,
     speed: number
   ): { videoId: string; videoPart: string }
   ```
   - Generates video processing parameters for FFmpeg filtering
   - Handles different media types (image, video, screen)
   - Returns video filter configuration with `videoId` and `videoPart`

3. **`getAudioPart(inputIndex: number, duration: number, delay: number, mixAudio: number)`**
   ```typescript
   function getAudioPart(
     inputIndex: number,
     duration: number,
     delay: number,
     mixAudio: number
   ): { audioId: string; audioPart: string }
   ```
   - Creates audio processing parameters for mixing
   - Handles audio trimming, delay, and volume mixing
   - Returns audio filter configuration with `audioId` and `audioPart`

### Usage Pattern

The typical workflow to create a movie:

1. Prepare your MulmoScript JSON with beats defining the content
2. Generate audio files for narration (using audio generation)
3. Prepare image/video files for visuals (using image generation)
4. Create a `MulmoStudioContext` with all resources
5. Call `movie(context)` to generate the final MP4 video

The package uses FFmpeg internally for video generation, combining audio, images, and transitions into a single video file.

### MulmoScript Format

Basic structure:
```typescript
interface MulmoScript {
  $mulmocast: { version: string };
  beats: Array<{
    text: string;
    image?: string;
    audio?: string;
  }>;
}

// Example:
const script: MulmoScript = {
  "$mulmocast": { "version": "1.0" },
  "beats": [
    {
      "text": "Hello World",
      "image": "path/to/image.png",
      "audio": "path/to/audio.mp3"
    }
  ]
};
```

### CLI Alternative

The package also provides CLI commands via the `mulmo` binary:
- `mulmo movie <script.json>` - Generate movie from script
- `mulmo audio <script.json>` - Generate audio only
- `mulmo images <script.json>` - Generate images only