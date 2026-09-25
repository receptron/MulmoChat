// renderShapeScript: a host tool that renders a ShapeScript model to a PNG
// sheet on the server (server/plugins/shapeRenderHost.ts) and shows it to the
// model, so the model can check a 3D model before presenting it.
//
// Its definition comes from @mulmoclaude/shapescript-plugin/render, a
// Node-only entry the browser can't import, so the server sends it (see
// hostTools.ts). Until then the tool stays disabled. The result is an image, shown
// with the same View as generateImage.
import { defineComponent, h, markRaw, type PropType } from "vue";
import {
  ImagePreview,
  ImageView,
  type ImageToolData,
  type ToolResult as ImageResult,
} from "@mulmochat-plugin/ui-image";
import type { ToolPlugin } from "./types";
import { runOnServer } from "./serverPlugin";
import { hostToolDefinition } from "./hostTools";

const TOOL_NAME = "renderShapeScript";

const { toolDefinition, isLoaded } = hostToolDefinition(
  TOOL_NAME,
  "Render a ShapeScript model to an image.",
);

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
  isEnabled: isLoaded,
  viewComponent: View,
  previewComponent: Preview,
};

export const RenderShapeScriptPlugin = {
  plugin: runOnServer(plugin, () => ({})),
};
