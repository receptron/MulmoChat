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
//   - pubsub   → no-op: MulmoChat has no server push channel yet
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
    return response.json();
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

// Nothing is ever published, so subscribing only returns an unsubscribe.
function subscribe(
  eventName: string,
  handler: (payload: unknown) => void,
): () => void;
function subscribe<T>(
  eventName: string,
  opts: SubscribeOptions<T>,
  handler: (payload: T) => void,
): () => void;
function subscribe(): () => void {
  return () => {};
}
const noopSubscribe: PluginSubscribe = subscribe;

function makeBrowserPluginRuntime(toolName: string): BrowserPluginRuntime {
  const tag = `[plugin/${toolName}]`;
  return {
    pubsub: { subscribe: noopSubscribe },
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
