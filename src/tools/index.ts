import type { StartApiResponse } from "../../server/types";
import type {
  BackendType,
  FileInputHandler,
  ClipboardImageInputHandler,
  InputHandler,
  ToolDefinition,
} from "gui-chat-protocol/vue";
import { v4 as uuidv4 } from "uuid";
import { getRole, ROLES } from "../config/roles";
import type { ToolPlugin, ToolExecuteFn, GetToolPluginFn } from "./types";
import { createToolDefinition as createSwitchRoleToolDefinition } from "@gui-chat-plugin/switch-role/vue";

// External plugins from npm packages
import QuizPlugin from "@mulmochat-plugin/quiz/vue";
import GenerateImagePlugin from "@mulmochat-plugin/generate-image/vue";
import FormPlugin from "@mulmoclaude/form-plugin/vue";
import SummarizePdfPlugin from "@mulmochat-plugin/summarize-pdf/vue";
import SpreadsheetPlugin from "@gui-chat-plugin/spreadsheet/vue";
import TodoPlugin from "@gui-chat-plugin/todo/vue";
import TextResponsePlugin from "@gui-chat-plugin/text-response/vue";
import OthelloPlugin from "@gui-chat-plugin/othello/vue";
import TicTacToePlugin from "@gui-chat-plugin/tictactoe/vue";
import GoPlugin from "@gui-chat-plugin/go/vue";
import WeatherPlugin from "@gui-chat-plugin/weather/vue";
import MusicPlugin from "@gui-chat-plugin/music/vue";
import BrowsePlugin from "@gui-chat-plugin/browse/vue";
import GoogleMapPlugin from "@gui-chat-plugin/google-map/vue";
import ExaPlugin from "@gui-chat-plugin/exa/vue";
import MarkdownPlugin from "@mulmoclaude/markdown-plugin/vue";
import EditImagePlugin from "@gui-chat-plugin/edit-image/vue";
import MulmoScriptPlugin from "@mulmoclaude/mulmoscript-plugin/vue";
import ShapeScriptPlugin from "@mulmoclaude/shapescript-plugin/vue";
import CameraPlugin from "@gui-chat-plugin/camera/vue";
import CanvasPlugin from "@gui-chat-plugin/canvas/vue";
import HtmlPlugin from "@mulmoclaude/html-plugin/vue";
import GenerateHtmlPlugin from "@gui-chat-plugin/generate-html/vue";
import EditHtmlPlugin from "@gui-chat-plugin/edit-html/vue";
import SwitchRolePlugin from "@gui-chat-plugin/switch-role/vue";
import SetImageStylePlugin from "@gui-chat-plugin/set-image-style/vue";
import ScrollToAnchorPlugin from "@gui-chat-plugin/scroll-to-anchor/vue";
import MindMapPlugin from "@gui-chat-plugin/mindmap/vue";
import PianoPlugin from "@gui-chat-plugin/piano/vue";
import DrawingGamePlugin from "@gui-chat-plugin/drawing-game/vue";
import AkinatorPlugin from "guichat-plugin-akinator/vue";
import AvatarPlugin from "@gui-chat-plugin/avatar/vue";
import ChartPlugin from "@mulmoclaude/chart-plugin/vue";
import { runOnServer } from "./serverPlugin";
import { wrapWithPluginRuntime } from "./pluginRuntime";
import { withMulmoScriptHostAdapter } from "./mulmoScriptHost";
import { RenderShapeScriptPlugin } from "./renderShapeScript";
import { ReadXPostPlugin, SearchXPlugin } from "./xTools";

// generateImage's own prompt says the model MUST draw whenever it talks about
// places, objects, people, movies or books. Every role that includes plugin
// prompts got it, so a model that follows it literally (Gemini Live in the
// Office role) drew a picture for almost every reply. A role that wants
// pictures all the time says so in its own prompt (Listener, Brainstorm).
// MulmoGlass replaced it for the same reason ("Tokyo's weather" drawn as an
// image instead of looked up).
const GENERATE_IMAGE_PROMPT =
  "Use generateImage when the user asks for a picture, or when an illustration clearly helps explain what you are talking about. Never use an image in place of information you don't have: an image can't show today's weather, the news or a price.";

// generateImage runs on the server (server/plugins/), with the user's image
// settings sent along so the server-side context.app.generateImage uses them.
const ServerGenerateImagePlugin = {
  plugin: runOnServer(
    { ...GenerateImagePlugin.plugin, systemPrompt: GENERATE_IMAGE_PROMPT },
    (context) => ({
      imageGeneration: context.app?.getImageGenerationSettings?.(),
    }),
  ),
};

// presentChart runs on the server, which saves the chart document into the
// shared workspace's artifacts/ area (context.files.artifacts).
const ServerChartPlugin = {
  plugin: runOnServer(ChartPlugin.plugin, () => ({})),
};

// presentDocument runs on the server, which saves documents into the shared
// workspace (artifacts/documents/) and fills image placeholders with the
// user's image settings. The package has no system prompt, so MulmoChat keeps
// the one from its previous markdown plugin.
const PRESENT_DOCUMENT_PROMPT = `Use the presentDocument tool to create structured documents with text and embedded images. This tool is ideal for:
- Guides, tutorials, and how-to content ("create a guide about...", "explain how to...")
- Educational content (lessons, explanations, timelines, concept visualizations)
- Reports and presentations (business reports, data analysis, infographics)
- Articles and blog posts with illustrations
- Documentation with diagrams or screenshots
- Recipes with step-by-step photos
- Travel guides with location images
- Product presentations or lookbooks
- Any content that combines written information with supporting visuals

IMPORTANT: Use this tool instead of just generating standalone images when the user wants informational or educational content with visuals. This creates a cohesive document with formatted text (markdown) AND images embedded at appropriate locations. For example, if asked to "create a guide about photosynthesis with a diagram", use presentDocument to create a full guide with explanatory text and the diagram embedded, rather than just generating the diagram image alone.

Format embedded images as: ![Detailed image prompt](__too_be_replaced_image_path__)`;

const ServerMarkdownPlugin = {
  plugin: runOnServer(
    { ...MarkdownPlugin.plugin, systemPrompt: PRESENT_DOCUMENT_PROMPT },
    (context) => ({
      imageGeneration: context.app?.getImageGenerationSettings?.(),
    }),
  ),
};

// presentHtml runs on the server, which saves pages under the shared
// workspace's artifacts/html/ and serves them to the View's sandboxed iframe
// (server/plugins/htmlHost.ts). The package's prompt also describes paths
// outside artifacts/html/, which MulmoChat doesn't open, so it gets its own.
const PRESENT_HTML_PROMPT = `Use presentHtml when the user asks for HTML output, dashboards, custom layouts, or interactive content. Provide EITHER \`html\` OR \`path\`, not both. \`html\` is a full self-contained document (\`<!DOCTYPE html>\`, \`<html>\`, \`<body>\`) with all CSS and JavaScript inlined or loaded from a CDN (cdn.jsdelivr.net, unpkg.com, cdnjs.cloudflare.com, cdn.plot.ly, Google Fonts); the page cannot make network requests (fetch/XHR). Images and media may come from those same CDNs, \`data:\` URLs or \`blob:\` URLs (inline SVG and canvas work too); any other host is blocked. It is saved to \`artifacts/html/<YYYY>/<MM>/...\`. \`path\` presents a page you saved earlier (\`artifacts/html/...\`) without re-saving it; the user's edits in the view overwrite that file.`;

const ServerHtmlPlugin = {
  plugin: runOnServer(
    { ...HtmlPlugin.plugin, systemPrompt: PRESENT_HTML_PROMPT },
    () => ({}),
  ),
};

// presentShapeScript runs on the server, which saves each model as a `.shape`
// file under artifacts/shapes/. The View loads and saves that file through
// dispatch (server/plugins/dispatch.ts).
const ServerShapeScriptPlugin = {
  plugin: runOnServer(ShapeScriptPlugin.plugin, () => ({})),
};

// presentMulmoScript runs on the server, which saves the storyboard under
// artifacts/stories/ and generates images, audio, the movie and PDFs with
// mulmocast (server/plugins/mulmoscriptHost.ts). Progress reaches the View as
// plugin events; movie and PDF downloads come from /api/mulmoscript/media.
const mulmoScriptPlugin = runOnServer(MulmoScriptPlugin.plugin, () => ({}));
const ServerMulmoScriptPlugin = {
  plugin: {
    ...mulmoScriptPlugin,
    viewComponent:
      mulmoScriptPlugin.viewComponent &&
      withMulmoScriptHostAdapter(mulmoScriptPlugin.viewComponent),
  },
};

const registeredPlugins = [
  // External plugins from npm packages
  QuizPlugin,
  ServerGenerateImagePlugin,
  FormPlugin,
  SummarizePdfPlugin,
  SpreadsheetPlugin,
  TodoPlugin,
  TextResponsePlugin,
  OthelloPlugin,
  TicTacToePlugin,
  GoPlugin,
  WeatherPlugin,
  MusicPlugin,
  BrowsePlugin,
  GoogleMapPlugin,
  ExaPlugin,
  ServerMarkdownPlugin,
  EditImagePlugin,
  ServerMulmoScriptPlugin,
  ServerShapeScriptPlugin,
  RenderShapeScriptPlugin,
  ReadXPostPlugin,
  SearchXPlugin,
  CameraPlugin,
  CanvasPlugin,
  ServerHtmlPlugin,
  GenerateHtmlPlugin,
  EditHtmlPlugin,
  SwitchRolePlugin,
  SetImageStylePlugin,
  ScrollToAnchorPlugin,
  MindMapPlugin,
  PianoPlugin,
  DrawingGamePlugin,
  AkinatorPlugin,
  AvatarPlugin,
  ServerChartPlugin,
];

// Every plugin's views get the browser plugin runtime (useRuntime()), which
// carries the user's language among other host capabilities.
const pluginList = registeredPlugins.map((entry) => {
  const { plugin } = entry;
  const toolName = plugin.toolDefinition.name;
  return {
    ...entry,
    plugin: {
      ...plugin,
      viewComponent:
        plugin.viewComponent &&
        wrapWithPluginRuntime(toolName, plugin.viewComponent),
      previewComponent:
        plugin.previewComponent &&
        wrapWithPluginRuntime(toolName, plugin.previewComponent),
    },
  };
});

export { setPluginLocale, setPluginDispatchConfig } from "./pluginRuntime";
export { loadHostToolDefinitions } from "./hostTools";

/**
 * Images a tool result shows the model, as image data URLs. A MulmoChat
 * extension of gui-chat-protocol's ToolResult: `imagesForModel` is sent to the
 * model after the tool's output (renderShapeScript's render of a 3D model).
 */
// The formats the text providers accept (server/llm/images.ts).
const MODEL_IMAGE_DATA_URL =
  /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

export const getImagesForModel = (result: object): string[] => {
  const images = (result as { imagesForModel?: unknown }).imagesForModel;
  return Array.isArray(images)
    ? images.filter(
        (image): image is string =>
          typeof image === "string" && MODEL_IMAGE_DATA_URL.test(image),
      )
    : [];
};

export const getPluginList = () => pluginList;

/**
 * Gets the list of available plugins for a given role
 * @param roleId - The current role ID
 * @returns Array of plugin names available in this role, or null if all plugins available
 */
export function getAvailablePluginsForRole(roleId: string): string[] | null {
  const role = getRole(roleId);

  // If role not found, default to all available
  if (!role) {
    return null;
  }

  // Customizable role: all plugins available for user to choose
  if (role.pluginMode === "customizable") {
    return null;
  }

  // Fixed role: return the exact list
  if (role.pluginMode === "fixed") {
    return role.availablePlugins || [];
  }

  // Fallback: all available
  return null;
}

/**
 * Checks if a plugin is available in the given role
 * @param pluginName - The name of the plugin
 * @param roleId - The current role ID
 * @returns true if plugin is available in the role
 */
export function isPluginAvailableInRole(
  pluginName: string,
  roleId: string,
): boolean {
  const availablePlugins = getAvailablePluginsForRole(roleId);

  // null means all plugins available (customizable role)
  if (availablePlugins === null) {
    return true;
  }

  // Check if plugin is in the fixed list
  return availablePlugins.includes(pluginName);
}

/**
 * Checks if the current role allows user customization of plugins
 * @param roleId - The current role ID
 * @returns true if user can toggle plugins in this role
 */
export function isRoleCustomizable(roleId: string): boolean {
  const role = getRole(roleId);
  return role?.pluginMode === "customizable";
}

// Pre-compute switchRole tool definition with app roles
const switchRoleToolDefinition = createSwitchRoleToolDefinition(
  ROLES.map((r) => ({ id: r.id, name: r.name })),
);

// gui-chat-protocol's ToolDefinition.prompt is for the host's system prompt
// (see getPluginSystemPrompts), not a field the model APIs accept.
const toolDefinitionForModel = (tool: ToolDefinition): ToolDefinition => {
  const definition = { ...tool };
  delete definition.prompt;
  return definition;
};

export const pluginTools = (
  startResponse?: StartApiResponse | null,
  enabledPlugins?: Record<string, boolean>,
  roleId?: string,
) => {
  return pluginList
    .filter((plugin) => {
      const toolName = plugin.plugin.toolDefinition.name;

      // Server-level: Does plugin have required API credentials?
      if (!plugin.plugin.isEnabled(startResponse)) {
        return false;
      }

      // If no role specified, default to enabled
      if (!roleId) {
        return enabledPlugins?.[toolName] ?? true;
      }

      // Role-level filtering
      const availableInRole = isPluginAvailableInRole(toolName, roleId);
      if (!availableInRole) {
        return false;
      }

      // User-level: Only applies to customizable roles
      if (isRoleCustomizable(roleId)) {
        return enabledPlugins?.[toolName] ?? true;
      }

      // Fixed role: plugin is in the list, so it's enabled
      return true;
    })
    .map((plugin) => {
      // Use dynamic tool definition for switchRole with app roles
      if (plugin.plugin.toolDefinition.name === "switchRole") {
        return switchRoleToolDefinition;
      }
      return toolDefinitionForModel(plugin.plugin.toolDefinition);
    });
};

export const getPluginSystemPrompts = (
  startResponse?: StartApiResponse | null,
  enabledPlugins?: Record<string, boolean>,
  roleId?: string,
): string => {
  const prompts = pluginList
    .filter((plugin) => {
      const toolName = plugin.plugin.toolDefinition.name;

      // Same filtering logic as pluginTools
      if (!plugin.plugin.isEnabled(startResponse)) {
        return false;
      }

      if (!roleId) {
        return enabledPlugins?.[toolName] ?? true;
      }

      const availableInRole = isPluginAvailableInRole(toolName, roleId);
      if (!availableInRole) {
        return false;
      }

      if (isRoleCustomizable(roleId)) {
        return enabledPlugins?.[toolName] ?? true;
      }

      return true;
    })
    .map(
      (plugin) =>
        plugin.plugin.systemPrompt ?? plugin.plugin.toolDefinition.prompt,
    )
    .filter((prompt): prompt is string => !!prompt);

  return prompts.length > 0 ? ` ${prompts.join("\n")}` : "";
};

const plugins = pluginList.reduce(
  (acc, plugin) => {
    acc[plugin.plugin.toolDefinition.name] = plugin.plugin as ToolPlugin<
      unknown,
      unknown,
      object
    >;
    return acc;
  },
  {} as Record<string, ToolPlugin<unknown, unknown, object>>,
);

export const toolExecute: ToolExecuteFn = async (context, name, args) => {
  console.log(`EXE:${name}\n`, args);
  const plugin = plugins[name];
  if (!plugin) {
    throw new Error(`Plugin ${name} not found`);
  }
  const result = await plugin.execute(context, args);

  // When updating existing result, preserve the original UUID to avoid race conditions
  const uuid =
    result.updating && context.currentResult?.uuid
      ? context.currentResult.uuid
      : result.uuid || uuidv4();

  return {
    ...result,
    toolName: result.toolName ?? name,
    uuid,
  };
};

export const getToolPlugin: GetToolPluginFn = (name) => {
  return plugins[name] || null;
};

/**
 * Gets plugins that have file input handlers
 */
export const getFileInputPlugins = () => {
  return pluginList
    .filter((plugin) =>
      plugin.plugin.inputHandlers?.some((h: InputHandler) => h.type === "file"),
    )
    .map((plugin) => {
      const fileHandler = plugin.plugin.inputHandlers!.find(
        (h: InputHandler) => h.type === "file",
      )!;
      return {
        toolName: plugin.plugin.toolDefinition.name,
        handler: fileHandler as FileInputHandler,
      };
    });
};

/**
 * Gets plugins that have clipboard-image input handlers
 */
export const getClipboardImagePlugins = () => {
  return pluginList
    .filter((plugin) =>
      plugin.plugin.inputHandlers?.some(
        (h: InputHandler) => h.type === "clipboard-image",
      ),
    )
    .map((plugin) => {
      const handler = plugin.plugin.inputHandlers!.find(
        (h: InputHandler) => h.type === "clipboard-image",
      )!;
      return {
        toolName: plugin.plugin.toolDefinition.name,
        handler: handler as ClipboardImageInputHandler,
      };
    });
};

/**
 * Gets all accepted file types across all plugins with file handlers
 */
export const getAcceptedFileTypes = () => {
  const filePlugins = getFileInputPlugins();
  const allTypes = filePlugins.flatMap(
    (plugin) => plugin.handler.acceptedTypes,
  );
  return Array.from(new Set(allTypes));
};

export const getPluginsWithConfig = (roleId?: string) => {
  return pluginList.filter((plugin) => {
    if (!plugin.plugin?.config?.component) return false;
    if (!roleId) return true;
    return isPluginAvailableInRole(plugin.plugin.toolDefinition.name, roleId);
  });
};

export const hasAnyPluginConfig = () => {
  return pluginList.some((plugin) => plugin.plugin.config?.component);
};

export const getPluginConfigValue = (
  configs: Record<string, unknown>,
  toolName: string,
  configKey: string,
): unknown => {
  const plugin = plugins[toolName];
  if (!plugin?.config || plugin.config.key !== configKey) return undefined;
  return configs[configKey] ?? plugin.config.defaultValue;
};

export const initializePluginConfigs = (): Record<string, unknown> => {
  const configs: Record<string, unknown> = {};
  pluginList.forEach((plugin) => {
    if (plugin.plugin.config) {
      configs[plugin.plugin.config.key] = plugin.plugin.config.defaultValue;
    }
  });
  return configs;
};

/**
 * Gets the set of backend types used by enabled plugins
 * Used to show only relevant backend settings in the UI
 * Note: Unlike pluginTools, this does NOT check isEnabled() because we want to show
 * backend settings even when API keys are not configured yet.
 */
export const getEnabledBackends = (
  enabledPlugins?: Record<string, boolean>,
  roleId?: string,
): Set<BackendType> => {
  const backends = new Set<BackendType>();

  pluginList.forEach((plugin) => {
    const toolName = plugin.plugin.toolDefinition.name;

    if (roleId) {
      const availableInRole = isPluginAvailableInRole(toolName, roleId);
      if (!availableInRole) {
        return;
      }

      if (isRoleCustomizable(roleId)) {
        if (!(enabledPlugins?.[toolName] ?? true)) {
          return;
        }
      }
    } else {
      if (!(enabledPlugins?.[toolName] ?? true)) {
        return;
      }
    }

    // Add backends from this plugin
    const pluginBackends = (plugin.plugin as ToolPlugin).backends;
    if (pluginBackends) {
      pluginBackends.forEach((backend: BackendType) => backends.add(backend));
    }
  });

  return backends;
};
