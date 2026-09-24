// The host adapter presentMulmoScript's View asks for: movie and PDF bytes
// for its download and clip buttons, from GET /api/mulmoscript/media
// (server/plugins/mulmoscriptHost.ts). A plain <video src> can't go through
// dispatch. Adapted from MulmoTerminal's src/plugins-registry.ts
// (https://github.com/receptron/mulmoterminal, MIT License, Copyright (c) 2026
// Receptron).
import { defineComponent, h, markRaw, provide, type Component } from "vue";
import {
  MULMOSCRIPT_HOST_ADAPTER_KEY,
  type MulmoScriptHostAdapter,
} from "@mulmoclaude/mulmoscript-plugin/vue";

// MulmoChat has one stories root, so the adapter's `root` is always empty.
async function fetchMediaBlob(query: {
  moviePath?: string;
  pdfPath?: string;
}): Promise<Blob> {
  const params = new URLSearchParams();
  if (query.moviePath) params.set("moviePath", query.moviePath);
  if (query.pdfPath) params.set("pdfPath", query.pdfPath);
  const response = await fetch(`/api/mulmoscript/media?${params}`);
  if (!response.ok) {
    throw new Error(`media download failed (${response.status})`);
  }
  return response.blob();
}

const adapter: MulmoScriptHostAdapter = { fetchMediaBlob };

/** Provide the mulmoscript host adapter around its View. */
export function withMulmoScriptHostAdapter(inner: Component): Component {
  return markRaw(
    defineComponent({
      name: "MulmoScriptHostAdapter",
      inheritAttrs: false,
      setup(_props, { attrs, slots }) {
        provide(MULMOSCRIPT_HOST_ADAPTER_KEY, adapter);
        return () => h(inner, attrs, slots);
      },
    }),
  );
}
