# MulmoChat Agent Guide

For the full architecture description see `CLAUDE.md`. This file is the short version.

## Overview
- Multi-modal chat client and reference implementation of [gui-chat-protocol](https://github.com/receptron/gui-chat-protocol).
- Three session transports: OpenAI Realtime (voice, WebRTC), Google Gemini Live (voice, WebSocket), and text chat through the server (OpenAI, Anthropic, Google, Grok, Ollama).
- Tool calls are executed by ~30 plugins from npm packages; each plugin supplies a view (main canvas) and a preview (sidebar).

## Repository Layout
- `src/` — Vue 3 + TypeScript client.
  - Entry `src/main.ts`; `src/App.vue` only holds `<router-view>`.
  - `src/views/HomeView.vue` is the main screen and wires the composables together.
  - `src/components/Sidebar.vue` has the controls, result previews, text input and settings. `src/components/settings/` holds the backend settings panels.
- `src/composables/` — `useSessionTransport` picks one of `useVoiceRealtimeSession`/`useRealtimeSession`, `useGoogleLiveSession`, `useTextSession`. Also `useToolResults`, `useUserPreferences` (localStorage), `useScrolling`.
- `src/config/` — roles (`roles.ts`), languages, realtime/live models (`models.ts`), text models (`textModels.ts`), session constants.
- `src/tools/` — plugin registry and filtering (`index.ts`), MulmoChat `ToolPlugin` type (`types.ts`), client helpers for server APIs (`backend/`).
- `server/` — Express server in TypeScript. Entry `server/index.ts` (port 3001). Routes in `server/routes/`, text LLM providers in `server/llm/`, winston logger in `server/utils/logger.ts`, shared types in `server/types.ts`.
- `benchmark/` — LLM benchmark harness. `docs/` — plugin guides and design notes.
- `dist/`, `build/`, `output/`, `logs/` — generated. Do not edit.

## Plugins
- Plugins are npm packages (`@gui-chat-plugin/*`, `@mulmochat-plugin/*`, and a few GitHub packages). Each exports `{ plugin }` from its `/vue` entry.
- To add one:
  1. Add the package to `package.json`.
  2. Import it in `src/tools/index.ts` and append it to `pluginList`.
  3. If a fixed role should use it, add the tool name to that role's `availablePlugins` in `src/config/roles.ts`.
- A plugin is enabled when all of these hold:
  - its `isEnabled(startResponse)` returns true, which depends on the server keys;
  - the current role allows it (`pluginMode` `fixed` vs `customizable`);
  - the user has not switched it off (customizable roles only).
- Keep plugin-specific code out of `HomeView.vue`, `App.vue` and the composables. Use `toolExecute` / `getToolPlugin` / `pluginTools` from `src/tools/index.ts`.
- Plugin policy changes must also be reflected in `docs/plugin-development-guide.md` and `docs/plugin-development-guide.ja.md`.
- Server-run plugins: `generateImage` and `presentChart` (`@mulmoclaude/chart-plugin`) run their `execute()` on the server. Plugins write files only through `context.files.artifacts`, rooted at `<workspace>/artifacts`.
  - The browser wraps the plugin with `runOnServer` (`src/tools/serverPlugin.ts`) and POSTs `{ args, config }` to `/api/plugin/<toolName>`.
  - `server/plugins/` loads the package and builds `context.app` per request.
  - The mechanism is adapted from MulmoTerminal's plugin registry. See `CLAUDE.md` for how to add a plugin this way.

## Server APIs (all under `/api`)
- `/start` — exchanges `OPENAI_API_KEY` for a Realtime ephemeral key, issued for the model in `?model=` (default `gpt-realtime-2.1`). It also returns feature flags and keys (`hasExaApiKey`, `hasAnthropicApiKey`, `hasGoogleApiKey`, `googleMapKey`, `googleApiKey`).
- `/text/providers`, `/text/generate` — text LLM. `/text/session/...` is a server-side session API; the current client doesn't use it.
- `/generate-image` (Gemini), `/generate-image/openai`, `/generate-image/comfy` (ComfyUI).
- `/plugin/:toolName` — runs a server-run plugin's `execute()`.
- `/generate-html`.
- `/check-pdf`, `/summarize-pdf`, `/generate-pdf`, `/save-pdf`, `/download-pdf`.
- `/generate-movie`, `/save-images`, `/download-movie`, `/viewer-json` (mulmocast).
- `/browse`, `/exa-search`, `/twitter-embed`, plus `/health` and `/config`.

## Scripts
- `yarn dev` runs the server (`tsx server/index.ts`) and Vite together. `yarn dev:server` / `yarn dev:client` start one side only (`yarn server` is the same as `yarn dev:server`).
- `yarn typecheck` (`vue-tsc --noEmit`), `yarn lint` (ESLint on `src` and `server`), `yarn format` (Prettier), `yarn knip` (dead code).
- `yarn test:text:<provider>`, `yarn test:tools:<provider>` and `yarn test:image:<comfy|openai>` are smoke tests. They call real APIs.
- `yarn benchmark:llm` runs the LLM benchmark.
- Avoid `yarn build` / `yarn preview` / `yarn start` during development; they create build artifacts.

## Environment Variables
- `OPENAI_API_KEY` — required; `/api/start` fails without it.
- `GEMINI_API_KEY` — Gemini images, Gemini Live and Google text models.
- `ANTHROPIC_API_KEY`, `XAI_API_KEY` — Anthropic and Grok text models.
- `EXA_API_KEY` (Exa search) and `GOOGLE_MAP_API_KEY` (map). Plugins that need a missing key are disabled.
- `OLLAMA_BASE_URL`, `COMFYUI_BASE_URL`, `COMFYUI_DEFAULT_MODEL`, `COMFYUI_TIMEOUT_MS`, `COMFYUI_POLL_INTERVAL_MS` — local backends.
- `MULMOCHAT_WORKSPACE` — workspace for plugin files. Defaults to `~/mulmoclaude`, which is shared with MulmoClaude and MulmoTerminal, when it exists; otherwise `output/workspace`. Use a scratch folder for tests.
- `PORT` and `NODE_ENV`. `.env` is ignored by git.

## Development Guidelines
- Code style:
  - TypeScript strict mode.
  - Vue SFCs use `<script setup lang="ts">`.
  - 2-space indentation, semicolons, Unix line endings.
- On the server, use `logger` / `logApiError` from `server/utils/logger.ts`. Don't add new `console.*` calls.
- Request bodies can be up to 500 MB (the Express body parser limit).

## Testing and CI
- There are no unit tests. CI (`.github/workflows/pull_request.yaml`) runs `typecheck`, `lint` and `build` on every PR. Separate workflows scan for dead code and duplicated code.
- Before committing, run `yarn typecheck`, `yarn lint` and `yarn format`.
