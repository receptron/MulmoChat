// Server-side plugin registry: loads gui-chat-protocol plugin packages and runs
// their execute() in-process, so a plugin's host backends (context.app) live on
// the server instead of in the browser.
//
// Adapted from MulmoTerminal's server/infra/plugins-registry.ts
// (https://github.com/receptron/mulmoterminal, MIT License, Copyright (c) 2026
// Receptron). Differences from the original:
//   - context.app is built per request (see appContext.ts), because MulmoChat's
//     backend settings (image backend, model, style) are per-user browser
//     preferences sent with each call, not server configuration.
//   - Only plain packages (a core entry exporting TOOL_DEFINITION + pluginCore)
//     are supported. definePlugin factories need the server-side PluginRuntime,
//     which will be added with the first plugin that uses one.
import { isPluginFactory } from "gui-chat-protocol";
import type { ToolContext, ToolDefinition } from "gui-chat-protocol";
import { logger } from "../utils/logger";
import { PLUGIN_PACKAGES } from "./config";

type Executor = (...args: unknown[]) => unknown;

export interface LoadedPlugin {
  toolName: string;
  definition: ToolDefinition;
  execute: (context: ToolContext, args: Record<string, unknown>) => unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isExecutor = (value: unknown): value is Executor =>
  typeof value === "function";

// The three required fields of a gui-chat-protocol ToolDefinition, checked
// rather than cast: a definition arrives from an imported module.
const isToolDefinition = (value: unknown): value is ToolDefinition =>
  isRecord(value) &&
  value.type === "function" &&
  typeof value.name === "string" &&
  typeof value.description === "string";

// Packages that name their executor descriptively (e.g. executePresentCollection)
// and ship no `execute`: pick the sole `execute*` export, or none if ambiguous.
function soleExecutor(mod: Record<string, unknown>): Executor | undefined {
  const fns = Object.entries(mod).flatMap(([key, value]) =>
    key.startsWith("execute") && isExecutor(value) ? [value] : [],
  );
  return fns.length === 1 ? fns[0] : undefined;
}

async function loadPackage(name: string): Promise<LoadedPlugin> {
  const mod: unknown = await import(name);
  if (!isRecord(mod)) {
    throw new Error(
      `Package "${name}" did not resolve to a module namespace object.`,
    );
  }
  if (isPluginFactory(mod.default)) {
    throw new Error(
      `Package "${name}" is a definePlugin factory, which is not supported yet.`,
    );
  }
  const core = isRecord(mod.pluginCore) ? mod.pluginCore : undefined;
  const definition = mod.TOOL_DEFINITION ?? core?.toolDefinition;
  const execute = core?.execute ?? mod.execute ?? soleExecutor(mod);
  if (!isToolDefinition(definition) || !isExecutor(execute)) {
    throw new Error(
      `Package "${name}" is not a gui-chat-protocol plugin (missing TOOL_DEFINITION/execute).`,
    );
  }
  return {
    toolName: definition.name,
    definition,
    execute: (context, args) => execute(context, args),
  };
}

async function loadPlugins(): Promise<Map<string, LoadedPlugin>> {
  const plugins = await Promise.all(PLUGIN_PACKAGES.map(loadPackage));
  // A Map, not a plain object: a tool name like "constructor" must not resolve
  // to an Object.prototype member.
  const byName = new Map<string, LoadedPlugin>();
  for (const plugin of plugins) {
    if (byName.has(plugin.toolName)) {
      logger.warn("Plugin tool declared more than once; last one wins", {
        toolName: plugin.toolName,
      });
    }
    byName.set(plugin.toolName, plugin);
  }
  logger.info("Server plugins loaded", { tools: [...byName.keys()] });
  return byName;
}

let pluginsPromise: Promise<Map<string, LoadedPlugin>> | null = null;

/** The loaded plugins, keyed by tool name. Loaded once, on first use. */
export function getServerPlugins(): Promise<Map<string, LoadedPlugin>> {
  pluginsPromise ??= loadPlugins();
  return pluginsPromise;
}
