// readXPost and searchX: host tools that read X (Twitter) posts through the
// X API v2 on the server (server/plugins/xHost.ts, @mulmoclaude/x-plugin).
// The server sends their definitions only when X_BEARER_TOKEN is set (see
// hostTools.ts), so without it they stay disabled. The package has no View;
// this one shows the text the model got.
import { defineComponent, h, markRaw, type PropType } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";
import type { ToolPlugin } from "./types";
import { runOnServer } from "./serverPlugin";
import { hostToolDefinition } from "./hostTools";

// server/plugins/xHost.ts XToolData
interface XToolData {
  url?: string;
  query?: string;
  text: string;
}

type XResult = ToolResult<XToolData>;

const titleOf = (result: XResult): string => {
  const data = result.data;
  if (data?.query) return `X search: ${data.query}`;
  if (data?.url) return `X post: ${data.url}`;
  return "X";
};

const View = markRaw(
  defineComponent({
    name: "XToolView",
    props: {
      selectedResult: {
        type: Object as PropType<XResult>,
        required: true,
      },
    },
    setup(props) {
      return () =>
        h("div", { class: "h-full overflow-y-auto p-6 bg-white" }, [
          h(
            "h2",
            { class: "text-lg font-semibold mb-4 break-all" },
            titleOf(props.selectedResult),
          ),
          h(
            "pre",
            { class: "whitespace-pre-wrap break-words font-sans text-sm" },
            props.selectedResult.data?.text ?? props.selectedResult.message,
          ),
        ]);
    },
  }),
);

const Preview = markRaw(
  defineComponent({
    name: "XToolPreview",
    props: {
      result: {
        type: Object as PropType<XResult>,
        required: true,
      },
    },
    setup(props) {
      return () =>
        h(
          "div",
          { class: "text-sm text-gray-700 truncate" },
          titleOf(props.result),
        );
    },
  }),
);

function xToolPlugin(
  name: string,
  description: string,
  generatingMessage: string,
): { plugin: ToolPlugin } {
  const { toolDefinition, isLoaded } = hostToolDefinition(name, description);
  const plugin: ToolPlugin = {
    toolDefinition,
    execute: async () => {
      throw new Error(`${name} runs on the server`);
    },
    generatingMessage,
    isEnabled: isLoaded,
    viewComponent: View,
    previewComponent: Preview,
  };
  return { plugin: runOnServer(plugin, () => ({})) };
}

export const ReadXPostPlugin = xToolPlugin(
  "readXPost",
  "Fetch an X (Twitter) post.",
  "Reading the X post...",
);

export const SearchXPlugin = xToolPlugin(
  "searchX",
  "Search recent X (Twitter) posts.",
  "Searching X...",
);
