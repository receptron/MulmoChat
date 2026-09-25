# MulmoChat architecture

The reference description of how MulmoChat is built: directory layout, session transports, tool results, preferences, roles, the plugin system, the server, environment variables and data flow. Working rules and traps for agents are in `CLAUDE.md`.

## Directory Layout

- `src/` — Vue 3 + TypeScript client
  - `main.ts`, `App.vue` (just a `<router-view>`), `router/index.ts` (`/` → `HomeView`, `/test` → `TestView`)
  - `views/HomeView.vue` — the main screen; wires all composables together
  - `components/` — `Sidebar.vue` (controls, result previews, text input, settings), `RightSidebar.vue`, `TextSelectionMenu.vue`, `settings/` (backend settings panels)
  - `composables/` — session transports, tool results, user preferences, scrolling
  - `config/` — roles, languages, realtime/live models, text models, session constants
  - `tools/` — plugin registry (`index.ts`), MulmoChat `ToolPlugin` type (`types.ts`), `backend/` (client helpers that call server APIs), `utils/`
  - `utils/` — audio codec/streaming helpers, `toolConverter.ts`
- `server/` — Express server (`index.ts`), routes in `routes/`, LLM providers in `llm/`, logger in `utils/logger.ts`, shared types in `types.ts`
- `benchmark/` — LLM benchmark harness (prompts, expected outputs, runner, verifier)
- `docs/` — plugin architecture/development guides and design notes; `plans/`, `plan/` — historical planning notes

## Main View (src/views/HomeView.vue)

HomeView orchestrates the UI: it creates `useUserPreferences`, `useSessionTransport`, `useToolResults` and `useScrolling`, routes tool calls from the session to `useToolResults`, and renders the selected result on the main canvas with `getToolPlugin(toolName).viewComponent`. The sidebar renders each result with the plugin's `previewComponent`. Listener-mode audio gating also lives here.

## Session Transports

`useSessionTransport` (src/composables/useSessionTransport.ts) holds all four sessions and exposes the active one through a common interface (`UseRealtimeSessionReturn`) plus a `capabilities` object. The transport is chosen by the user's model kind preference:

- **`voice-realtime`** — `useVoiceRealtimeSession` → `useRealtimeSession`: OpenAI Realtime over WebRTC. Fetches an ephemeral key from `/api/start?model=<id>` (the key is bound to that model), opens an `oai-events` data channel, streams microphone audio, accumulates function-call arguments and dispatches tool calls. Models in `config/models.ts` (`REALTIME_MODELS`).
- **`voice-google-live`** — `useGoogleLiveSession`: Gemini Live API over a WebSocket opened directly from the browser with the Gemini key returned by `/api/start`, with PCM encoding/playback via `utils/audioCodec.ts` and `utils/audioStreamManager.ts`. Models in `GOOGLE_LIVE_MODELS`.
- **`voice-grok`** — `useGrokVoiceSession`: xAI's Voice Agent API over a WebSocket opened from the browser. The events are OpenAI Realtime's; the audio is PCM16 through `AudioStreamManager`, like Gemini Live. The server mints a short-lived client secret (`/api/start?voice=grok`, from `XAI_API_KEY`), which the browser passes as the `xai-client-secret.<secret>` subprotocol. Follow-up instructions go in as user messages (a `response.create` with `instructions` would replace the system prompt), and a `response.create` asked for while a response runs is sent after it. Grok takes no image input, so `sendImagesToModel` returns false. Models in `GROK_VOICE_MODELS`.
- **`text-rest`** — `useTextSession`: keeps the conversation history on the client and calls the stateless `/api/text/generate` endpoint for each turn. Model IDs are `provider:model` strings (`config/textModels.ts`, default `openai:gpt-4o-mini`).

All four share the same event handler contract (`onToolCall`, `onTextDelta`, conversation start/stop, speech start/stop) and send tool outputs and follow-up instructions back through the active session.

## Tool Results (src/composables/useToolResults.ts)

- Maintains the array of results and the selected result
- Executes plugins via `toolExecute(context, toolName, args)`; the context includes the current result, roles, and `setConfig` (only for plugins in `PLUGINS_WITH_SET_CONFIG`)
- Replaces the existing result when `result.updating === true` (keeping its UUID), otherwise appends
- Sends follow-up `instructions` unless suppressed (plugins can force them with `instructionsRequired`)
- Honors `delayAfterExecution` and shows `generatingMessage` while running
- On failure, sends a retry instruction back to the model
- Handles uploaded files and pasted images through plugin input handlers

## User Preferences (src/composables/useUserPreferences.ts)

All preferences persist to localStorage. Keys:

- `user_language_v1`, `suppress_instructions_v1`, `show_role_list_v1`, `role_id_v1`
- `enabled_plugins_v1`, `custom_instructions_v1`, `plugin_configs_v1`
- `model_id_v1` (voice model), `model_kind_v2` (transport), `text_model_id_v1`
- `image_generation_backend_v1`, `comfyui_model_v1`
- Legacy keys migrated on load: `mode_id_v2`, `system_prompt_id_v1`

It also builds the final instructions (role prompt + plugin system prompts + custom instructions + language) and the enabled tool list.

## Roles (src/config/roles.ts)

The old "system prompts"/"modes" are now **roles** (`general`, `tutor`, `listener`, `game`, `office`, `mulmoCaster`, …; default `general`). Each role has a prompt, an icon, `includePluginPrompts`, and a `pluginMode`:
- `customizable` — all plugins available; the user toggles them
- `fixed` — only the plugins listed in `availablePlugins`

The model can change role through the `switchRole` plugin, whose tool definition is generated from `ROLES`.

## Plugin System

HomeView, App.vue and the composables reach plugins only through the centralized interface in `src/tools/index.ts` (`toolExecute`, `getToolPlugin`, `pluginTools`, …); see CLAUDE.md.

Plugins are **external npm packages**, not source files in this repo. Each package exports `{ plugin }` from a `/vue` entry point that implements gui-chat-protocol's `ToolPlugin`: `toolDefinition`, `execute`, `isEnabled(startResponse)`, `viewComponent`, `previewComponent`, and optionally `systemPrompt`, `inputHandlers` (file / clipboard-image), `config` (a settings component with key and default value), `backends`, `generatingMessage`, `delayAfterExecution`.

`src/tools/index.ts`:
- `pluginList` — the registered plugins (from `@gui-chat-plugin/*`, `@mulmochat-plugin/*`, and GitHub packages such as piano and `guichat-plugin-akinator`)
- `pluginTools()` / `getPluginSystemPrompts()` — filter by `isEnabled` (server keys), then role, then user toggles
- `toolExecute()` / `getToolPlugin()` — execution and lookup by tool name
- `getFileInputPlugins()`, `getClipboardImagePlugins()`, `getAcceptedFileTypes()` — input handlers
- `getPluginsWithConfig()`, `initializePluginConfigs()`, `getPluginConfigValue()` — plugin settings
- `getEnabledBackends()` — which backend settings panels (text LLM, image gen, mulmocast) to show

`src/tools/types.ts` specializes the protocol's `ToolPlugin` with `StartApiResponse` as the server response type.

To add a plugin: add the package to `package.json`, import its `/vue` entry in `src/tools/index.ts`, and append it to `pluginList`. If it is used by a fixed role, add its tool name to that role's `availablePlugins`.

### Server-run plugins

Some plugins run their `execute()` on the server instead of in the browser. The mechanism is adapted from MulmoTerminal's plugin registry, so the same npm packages run the same way in MulmoChat, MulmoTerminal and MulmoClaude. Currently `generateImage` (`@mulmochat-plugin/generate-image`), `presentChart` (`@mulmoclaude/chart-plugin`), `presentDocument` (`@mulmoclaude/markdown-plugin`), `presentHtml` (`@mulmoclaude/html-plugin`), `presentShapeScript` (`@mulmoclaude/shapescript-plugin`) and `presentMulmoScript` (`@mulmoclaude/mulmoscript-plugin`) run this way. The Office role has chart, html and mulmoscript; the 3D Modeler role has shapescript and renderShapeScript. presentShapeScript replaced `@gui-chat-plugin/present3d` (`present3D`), and presentMulmoScript replaced `@gui-chat-plugin/mulmocast` (`showPresentation`) in every role.

`presentDocument` saves each document as `<workspace>/artifacts/documents/YYYY/MM/<prefix>-<id>.md` and stores only that path in the result, so its View loads, edits and exports the file through `useRuntime().dispatch`. The host backends it calls (`loadDoc`, `saveDoc`, `saveNewDoc`, `fillImages`, `exportPdf`, `marpThemes`) are in `server/plugins/markdownHost.ts`. They only touch `.md` files inside the workspace (MulmoTerminal also opens absolute paths; MulmoChat doesn't). Images are inlined as data URLs, and PDFs are rendered with puppeteer with JavaScript disabled. MulmoChat keeps its previous system prompt for the tool, since the package has none.

- **Browser:** `runOnServer(plugin, buildConfig)` (`src/tools/serverPlugin.ts`) keeps the plugin's views, input handlers and system prompt, and replaces `execute` with `POST /api/plugin/<toolName>` carrying `{ args, config }`. `config` holds per-user settings the server needs. For images it comes from `context.app.getImageGenerationSettings()`.
- **Server:** `server/plugins/config.ts` lists the packages. `server/plugins/registry.ts` loads each package's core entry (`TOOL_DEFINITION` + `pluginCore.execute`). `server/routes/plugins.ts` runs `execute` with a `context.app` built per request by `server/plugins/appContext.ts`.
- **Files:** plugins get `context.files.artifacts`, a rooted `FileOps` over `<workspace>/artifacts` (`server/plugins/fileOps.ts`, copied from MulmoTerminal). Paths that escape the root, including through symlinks, are refused. The workspace (`server/plugins/workspace.ts`) is `MULMOCHAT_WORKSPACE`, else the `~/mulmoclaude` workspace shared with MulmoClaude and MulmoTerminal if it exists, else `output/workspace`. MulmoChat never creates or seeds the shared workspace. Over HTTP it serves only presentHtml pages and presentMulmoScript movies and PDFs (below).
- **View actions:** a View's `useRuntime().dispatch({ kind, … })` reaches the same route. Most packages handle it in `execute()`; a package that handles it in a separate function is listed in `server/plugins/dispatch.ts` (presentHtml's `loadHtml` / `saveHtml` / `packHtml` in `server/plugins/htmlHost.ts`, presentShapeScript's `loadShape` / `saveShape`, and presentMulmoScript's kinds). `dispatch.ts` can also replace a tool call's `execute()` when the host must do more (presentMulmoScript).
- **Plugin events:** a server backend can send events to its plugin's Views outside a request with `publishPluginEvent(toolName, event, data)` (`server/plugins/events.ts`). They stream to the browser as server-sent events at `GET /api/plugin-events` (loopback only, like the other plugin routes), and the runtime delivers each one only to that tool's `pubsub.subscribe(event)`.
- **renderShapeScript:** a host tool (no package registers it) that renders a ShapeScript model to a PNG sheet of four camera angles with puppeteer, so the model can check its 3D model before presenting it. `server/plugins/shapeRenderHost.ts` wraps `@mulmoclaude/shapescript-plugin/render`, saves the sheet under `artifacts/renders/`, and reads sources only from `artifacts/shapes/`. That entry is Node-only, so the server sends the definition (`GET /api/plugin-host-tools`, `HOST_TOOL_DEFINITIONS` in `dispatch.ts`) and `src/tools/renderShapeScript.ts` fills it in at startup; the result shows with generateImage's image View.
- **Images for the model:** a result can set `imagesForModel` (image data URLs, a MulmoChat extension of `ToolResult`; `getImagesForModel` in `src/tools/index.ts`). `useToolResults` passes them to the transport's `sendImagesToModel` after the tool output: Realtime adds a user message with `input_image`, Gemini Live an open user turn with `inlineData` (Grok voice takes no images), and text chat a user message with `images` (converted per provider in `server/llm/providers/`, validated by `server/llm/images.ts`). Text chat holds them until the turn's tool outputs are all in, then gives the model a follow-up turn to look (at most 3 in a row).
- **presentMulmoScript:** `server/plugins/mulmoscriptHost.ts` gives the package's `./server` ops MulmoChat's backend. Storyboards are saved in `<workspace>/artifacts/stories/`, and mulmocast writes images, audio, movies and PDFs next to them. Generation needs ffmpeg and reads `OPENAI_API_KEY` / `GEMINI_API_KEY` from the server's environment. Progress (`generation`) and model edits (`scriptChanged`) reach open Views as plugin events. The View downloads movies and PDFs from `GET /api/mulmoscript/media` through a host adapter (`src/tools/mulmoScriptHost.ts`). Unlike MulmoTerminal, scripts can't be opened by absolute path or from other directories.
- **File changes:** the workspace `FileOps` record what a request wrote (`server/plugins/fileChanges.ts`), and the route returns the list in the `X-Workspace-Files-Changed` header. The browser runtime publishes `file:<path>` on its pubsub, so open Views of those files reload (MulmoTerminal and MulmoClaude push the same event over a socket).
- **presentHtml pages:** `GET /artifacts/html/<path>` (`htmlPreviewRouter`, proxied by Vite in dev) serves pages to the View's iframe with a CSP of `sandbox allow-scripts` and `connect-src 'none'`: the model-written page gets an opaque origin, so it can't reach `/api` or the app's storage, and can't send requests. Scripts, styles, fonts, images and media only load from a small CDN allowlist (plus `data:`/`blob:` for images and media), so a script can't send data out in an image URL either. The route only accepts loopback connections and a loopback `Host` (DNS rebinding), and drops the CORS header. Unlike MulmoTerminal there is no `/htmlfile` mount, so pages stay inside `artifacts/html/`.
- **Adding one:** add the package to `server/plugins/config.ts`, add any backend it calls to `createAppContext`, and wrap its `pluginList` entry with `runOnServer`. `definePlugin` factory packages are not supported yet. For `@mulmoclaude/*` packages, their stylesheets are picked up by the glob in `src/main.ts`.

### Plugin runtime

Every plugin's View and Preview is wrapped by `wrapWithPluginRuntime` (`src/tools/pluginRuntime.ts`, adapted from MulmoTerminal), which provides gui-chat-protocol's `BrowserPluginRuntime` under `PLUGIN_RUNTIME_KEY`, so components can call `useRuntime()`. `locale` follows the user's language (HomeView calls `setPluginLocale`; `pt` becomes `pt-BR`), which is how `createUseT()` plugins such as form and chart show translated text. `dispatch` posts `{ args, config }` to `/api/plugin/<toolName>`, where `config` is the user's image settings (HomeView calls `setPluginDispatchConfig`), `openUrl` opens http(s) only, and `pubsub` is an in-page bus that carries the `file:<path>` events above (shared by all plugins) and the plugin events streamed from the server (per tool).

gui-chat-protocol's `ToolDefinition.prompt` is for the host's system prompt: `pluginTools()` strips it from the tool definitions sent to models, and `getPluginSystemPrompts()` uses it when a plugin has no `systemPrompt`.

## Server Architecture

- **server/index.ts** — Express app on `PORT` (default 3001), JSON body limit 500 MB, `/api/health`, `/api/config`, static `/output` for generated files, serves the client in production
- **server/routes/api.ts** — `/api/start`, `/api/browse`, `/api/exa-search`, `/api/twitter-embed`; mounts the other routers:
  - `textLLM.ts` — `/api/text/providers`, `/api/text/generate`, and server-side sessions under `/api/text/session…` (not used by the current client)
  - `image.ts` — `/api/generate-image` (Gemini), `/api/generate-image/openai`
  - `comfyui.ts` — `/api/generate-image/comfy`
  - `plugins.ts` — `/api/plugin/:toolName` (server-run plugins; see Plugin System). `/api/plugin-events` (`server/plugins/events.ts`) and `/api/mulmoscript/media` (`server/plugins/mulmoscriptHost.ts`) are mounted next to it
  - The image routes are thin wrappers around `generateGeminiImage`, `generateOpenAIImage` and `generateComfyImage`. The server-side `context.app.generateImage` reuses them. Failures are thrown as `ImageGenerationError` with the HTTP status to send back (`server/utils/imageGenerationError.ts`).
  - `html.ts` — `/api/generate-html`
  - `pdf.ts` — `/api/check-pdf`, `/api/summarize-pdf`, `/api/generate-pdf`, `/api/save-pdf`, `/api/download-pdf`
  - `movie.ts` — `/api/save-images`
- **server/llm/** — `textService.ts` sends text generation to providers in `providers/` (OpenAI, Anthropic, Google, Grok, Ollama) with per-provider default models; `textSessionStore.ts` stores server-side sessions
- **server/utils/logger.ts** — winston logger with daily rotating files in `logs/`; use `logger` / `logApiError` instead of `console.*` for new server code

`/api/start` returns a `StartApiResponse` with the OpenAI ephemeral key (minted for the `model` query parameter if it matches `gpt-realtime*`, otherwise `gpt-realtime-2.1`) and feature flags (`hasExaApiKey`, `hasAnthropicApiKey`, `hasGoogleApiKey`, `hasXaiApiKey`, `googleMapKey`, `googleApiKey`). With `?voice=grok` it mints an xAI client secret (`grokClientSecret`) instead of the OpenAI key. Plugins read these in `isEnabled()`.

## Environment Variables (.env)

- `OPENAI_API_KEY` — required by `/api/start` (all transports call it; Grok voice doesn't need it)
- `GEMINI_API_KEY` — Gemini image generation, Gemini Live, Google text models
- `ANTHROPIC_API_KEY` — Anthropic text models; `XAI_API_KEY` — Grok voice and Grok text models
- `EXA_API_KEY` — Exa search; `GOOGLE_MAP_API_KEY` — map plugin
- `OLLAMA_BASE_URL`, `COMFYUI_BASE_URL`, `COMFYUI_DEFAULT_MODEL`, `COMFYUI_TIMEOUT_MS`, `COMFYUI_POLL_INTERVAL_MS` — local backends
- `MULMOCHAT_ALLOWED_ORIGINS` — extra browser origins (comma-separated) allowed to call `/api/plugin/*`, e.g. `http://mac.local:5173` when opening the dev server from another device. Loopback origins are always allowed; the Host header is not trusted (DNS rebinding). Requests must be JSON (`server/utils/trustedOrigin.ts`).
- `MULMOCHAT_ALLOW_REMOTE_PLUGINS` — `/api/plugin/*` only accepts connections from this machine (the Vite proxy connects from localhost, so the dev app works from other devices). Set to `true` to accept other machines, only on a trusted network.
- `MULMOCHAT_WORKSPACE` — workspace for server-run plugins' files (default: `~/mulmoclaude` if it exists, else `output/workspace`). Point it at a scratch folder when testing.
- `PORT`, `NODE_ENV`

## Data Flow

### Session Start
1. User clicks start in the Sidebar; HomeView calls `session.startChat()`
2. The active transport fetches `/api/start`
3. Voice-realtime: creates RTCPeerConnection + `oai-events` data channel, gets microphone, exchanges SDP with OpenAI, then sends `session.update` with instructions and tools. Google Live: opens the Live WebSocket and sends the same instructions and tools. Grok voice: opens the xAI WebSocket with the client secret and sends `session.update`. Text: stores instructions and tools for the next request.

### Tool Call
1. The transport receives a function call (Realtime `response.function_call_arguments.done`, a Live tool call, or `toolCalls` from `/api/text/generate`) and calls `onToolCall`
2. HomeView forwards it to `useToolResults.handleToolCall()`
3. The plugin runs via `toolExecute`; the result is appended or updates the selected result, is previewed in the sidebar and shown on the canvas
4. The function output is sent back through the transport, followed by optional `instructions`

### User Text Message
1. Sidebar emits `send-text-message`
2. HomeView waits for the conversation to be inactive (`SESSION_CONFIG.MESSAGE_SEND_RETRY_ATTEMPTS` × `MESSAGE_SEND_RETRY_DELAY_MS`)
3. Calls `session.sendUserMessage(text)` on the active transport

### Listener Role
When `roleId === "listener"`: if the user has been speaking longer than `LISTENER_MODE_SPEECH_THRESHOLD_MS` (15 s) when speech stops, HomeView disables local audio for `LISTENER_MODE_AUDIO_GAP_MS` (2 s) and then restores it according to the mute state, so the model gets a chance to generate images.

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