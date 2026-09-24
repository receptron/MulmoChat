// The gui-chat-protocol BrowserPluginRuntime that MulmoChat provides to plugin
// views under PLUGIN_RUNTIME_KEY, so components can call useRuntime() (and
// createUseT() can read the user's language). Adapted from MulmoTerminal's
// src/composables/pluginRuntime.ts (https://github.com/receptron/mulmoterminal,
// MIT License, Copyright (c) 2026 Receptron).
//
//   - locale   → the user's language setting (setPluginLocale)
//   - dispatch → POST /api/plugin/<toolName> with { args, config }, the route
//                server-run plugins use (server/routes/plugins.ts). `config`
//                carries the user's settings (setPluginDispatchConfig), so
//                server backends such as image generation use them.
//   - pubsub   → an in-page bus. The only events are `file:<path>` for
//                workspace files a plugin request wrote (publishFileChanges),
//                which @mulmoclaude Views use to reload
//   - openUrl  → http(s) only, in a new tab
//   - log      → console, tagged with the tool name
import {
  defineComponent,
  h,
  markRaw,
  provide,
  ref,
  type Component,
  type Ref,
} from "vue";
import {
  PLUGIN_RUNTIME_KEY,
  type BrowserPluginRuntime,
  type SubscribeOptions,
} from "gui-chat-protocol/vue";

// Plugins key their message tables by locale tag (en, ja, pt-BR, …). MulmoChat's
// language codes match those tags except Portuguese. Languages a plugin has no
// table for fall back to English inside the plugin.
const LOCALE_TAGS: Readonly<Record<string, string>> = { pt: "pt-BR" };

const pluginLocale: Ref<string> = ref("en");

/** Set the locale every plugin view reads (MulmoChat language code). */
export function setPluginLocale(languageCode: string): void {
  pluginLocale.value = LOCALE_TAGS[languageCode] ?? languageCode;
}

// Per-user settings sent with every dispatch, like runOnServer's config.
let dispatchConfig: Record<string, unknown> = {};

/** Set the settings dispatch sends (e.g. { imageGeneration }). */
export function setPluginDispatchConfig(config: Record<string, unknown>): void {
  dispatchConfig = config;
}

const isOpenableUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

function makeDispatch(toolName: string): BrowserPluginRuntime["dispatch"] {
  const url = `/api/plugin/${encodeURIComponent(toolName)}`;

  async function post(args: object): Promise<unknown> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: args ?? {}, config: dispatchConfig }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `plugin/${toolName} dispatch failed (${response.status}): ${detail || response.statusText}`,
      );
    }
    const raw: unknown = await response.json();
    publishFileChanges(response);
    return raw;
  }

  async function dispatch(args: object): Promise<unknown>;
  async function dispatch<T>(
    args: object,
    parse: (raw: unknown) => T,
  ): Promise<T>;
  async function dispatch<T>(args: object, parse?: (raw: unknown) => T) {
    const raw = await post(args);
    return parse ? parse(raw) : raw;
  }
  return dispatch;
}

type PluginSubscribe = BrowserPluginRuntime["pubsub"]["subscribe"];

// Shared by every plugin: a file-change event is about the file, not about
// the plugin that wrote it (a document can be open in two Views).
const channels = new Map<string, Set<(payload: unknown) => void>>();

// One failing subscriber (e.g. a `parse` that throws) must not stop the rest.
function publish(eventName: string, payload: unknown): void {
  for (const handler of channels.get(eventName) ?? []) {
    try {
      handler(payload);
    } catch (error) {
      console.warn(`[plugin] subscriber to ${eventName} failed`, error);
    }
  }
}

function subscribe(
  eventName: string,
  handler: (payload: unknown) => void,
): () => void;
function subscribe<T>(
  eventName: string,
  opts: SubscribeOptions<T>,
  handler: (payload: T) => void,
): () => void;
function subscribe<T>(
  eventName: string,
  ...rest:
    | [handler: (payload: unknown) => void]
    | [opts: SubscribeOptions<T>, handler: (payload: T) => void]
): () => void {
  let listener: (payload: unknown) => void;
  if (rest.length === 1) {
    listener = rest[0];
  } else {
    const [opts, handler] = rest;
    listener = (raw) => {
      const payload = opts.parse(raw);
      if (payload !== null) handler(payload);
    };
  }
  const handlers = channels.get(eventName) ?? new Set();
  handlers.add(listener);
  channels.set(eventName, handlers);
  return () => handlers.delete(listener);
}
const pluginSubscribe: PluginSubscribe = subscribe;

const FILES_CHANGED_HEADER = "X-Workspace-Files-Changed";

/** Tell open Views that a plugin request wrote these workspace files
 *  (server/plugins/fileChanges.ts). */
export function publishFileChanges(response: Response): void {
  const header = response.headers.get(FILES_CHANGED_HEADER);
  if (!header) return;
  let paths: unknown;
  try {
    paths = JSON.parse(decodeURIComponent(header));
  } catch {
    return;
  }
  if (!Array.isArray(paths)) return;
  const mtimeMs = Date.now();
  for (const filePath of paths) {
    if (typeof filePath === "string") publish(`file:${filePath}`, { mtimeMs });
  }
}

function makeBrowserPluginRuntime(toolName: string): BrowserPluginRuntime {
  const tag = `[plugin/${toolName}]`;
  return {
    pubsub: { subscribe: pluginSubscribe },
    locale: pluginLocale,
    log: {
      debug: (msg, data) => console.debug(tag, msg, data),
      info: (msg, data) => console.info(tag, msg, data),
      warn: (msg, data) => console.warn(tag, msg, data),
      error: (msg, data) => console.error(tag, msg, data),
    },
    openUrl: (url) => {
      if (!isOpenableUrl(url)) {
        console.warn(tag, "openUrl rejected a non-http(s) URL", { url });
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    },
    dispatch: makeDispatch(toolName),
  };
}

/** Wrap a plugin component so it (and its children) can call useRuntime(). */
export function wrapWithPluginRuntime(
  toolName: string,
  inner: Component,
): Component {
  return markRaw(
    defineComponent({
      name: `PluginRuntimeScope:${toolName}`,
      inheritAttrs: false,
      setup(_props, { attrs, slots }) {
        provide(PLUGIN_RUNTIME_KEY, makeBrowserPluginRuntime(toolName));
        return () => h(inner, attrs, slots);
      },
    }),
  );
}
