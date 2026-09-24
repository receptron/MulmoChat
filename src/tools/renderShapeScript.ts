// renderShapeScript: a host tool that renders a ShapeScript model to a PNG
// sheet on the server (server/plugins/shapeRenderHost.ts) and shows it to the
// model, so the model can check a 3D model before presenting it.
//
// Its definition comes from @mulmoclaude/shapescript-plugin/render, a
// Node-only entry the browser can't import, so the server sends it
// (GET /api/plugin-host-tools) and loadHostToolDefinitions() fills it in at
// startup. Until then the tool stays disabled. The result is an image, shown
// with the same View as generateImage.
import { defineComponent, h, markRaw, type PropType } from "vue";
import type { ToolDefinition } from "gui-chat-protocol/vue";
import {
  ImagePreview,
  ImageView,
  type ImageToolData,
  type ToolResult as ImageResult,
} from "@mulmochat-plugin/ui-image";
import type { ToolPlugin } from "./types";
import { runOnServer } from "./serverPlugin";

const TOOL_NAME = "renderShapeScript";

// Filled from the server; the fields here are placeholders until then.
const toolDefinition: ToolDefinition = {
  type: "function",
  name: TOOL_NAME,
  description: "Render a ShapeScript model to an image.",
  parameters: { type: "object", properties: {}, required: [] },
};
let definitionLoaded = false;

/** Fetch the definitions of the tools the server provides itself. */
export async function loadHostToolDefinitions(): Promise<void> {
  try {
    const response = await fetch("/api/plugin-host-tools");
    if (!response.ok) return;
    const { tools } = (await response.json()) as { tools?: unknown };
    if (!Array.isArray(tools)) return;
    const definition = tools.find(
      (tool): tool is ToolDefinition =>
        typeof tool === "object" && tool !== null && tool.name === TOOL_NAME,
    );
    if (definition) {
      Object.assign(toolDefinition, definition);
      definitionLoaded = true;
    }
  } catch (error) {
    console.warn("[renderShapeScript] tool definition unavailable", error);
  }
}

// The render as an image, with the View and Preview generateImage uses.
const View = markRaw(
  defineComponent({
    name: "RenderShapeScriptView",
    props: {
      selectedResult: {
        type: Object as PropType<ImageResult<ImageToolData>>,
        required: true,
      },
    },
    setup(props) {
      return () => h(ImageView, { selectedResult: props.selectedResult });
    },
  }),
);

const Preview = markRaw(
  defineComponent({
    name: "RenderShapeScriptPreview",
    props: {
      result: {
        type: Object as PropType<ImageResult<ImageToolData>>,
        required: true,
      },
    },
    setup(props) {
      return () => h(ImagePreview, { result: props.result });
    },
  }),
);

const plugin: ToolPlugin = {
  toolDefinition,
  execute: async () => {
    throw new Error("renderShapeScript runs on the server");
  },
  generatingMessage: "Rendering the 3D model...",
  isEnabled: () => definitionLoaded,
  viewComponent: View,
  previewComponent: Preview,
};

export const RenderShapeScriptPlugin = {
  plugin: runOnServer(plugin, () => ({})),
};
