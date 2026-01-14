<template>
  <div class="markdown-container">
    <div
      v-if="!selectedResult.data?.markdown"
      class="min-h-full p-8 flex items-center justify-center"
    >
      <div class="text-gray-500">No markdown content available</div>
    </div>
    <template v-else>
      <div class="markdown-content-wrapper">
        <div class="p-4">
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 1em;
            "
          >
            <h1 style="font-size: 2em; margin: 0">
              {{ selectedResult.title || "Document" }}
            </h1>
            <div style="display: flex; gap: 0.5em">
              <button
                @click="downloadMarkdown"
                style="
                  padding: 0.5em 1em;
                  background-color: #4caf50;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 0.9em;
                  display: flex;
                  align-items: center;
                  gap: 0.5em;
                "
              >
                <span class="material-icons" style="font-size: 1.2em"
                  >download</span
                >
                MD
              </button>
              <button
                @click="downloadPdf"
                :disabled="!pdfPath"
                :style="{
                  padding: '0.5em 1em',
                  backgroundColor: pdfPath ? '#2196f3' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: pdfPath ? 'pointer' : 'not-allowed',
                  fontSize: '0.9em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5em',
                }"
              >
                <span
                  class="material-icons"
                  :style="{
                    fontSize: '1.2em',
                    animation: isGeneratingPdf
                      ? 'spin 1s linear infinite'
                      : 'none',
                  }"
                >
                  {{ isGeneratingPdf ? "hourglass_empty" : "download" }}
                </span>
                PDF
              </button>
            </div>
          </div>
          <div
            v-if="pdfError"
            style="
              margin: 1em 0;
              padding: 1em;
              background: #ffebee;
              border-radius: 4px;
              color: #c62828;
            "
          >
            PDF generation failed: {{ pdfError }}
          </div>
          <div
            class="markdown-content prose prose-slate max-w-none"
            v-html="renderedHtml"
          ></div>
        </div>
      </div>

      <details class="markdown-source">
        <summary>Edit Markdown Source</summary>
        <textarea
          v-model="editableMarkdown"
          @input="handleMarkdownEdit"
          class="markdown-editor"
          spellcheck="false"
        ></textarea>
        <button
          @click="applyMarkdown"
          class="apply-btn"
          :disabled="!hasChanges"
        >
          Apply Changes
        </button>
      </details>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import { marked } from "marked";
import type { ToolResult } from "../types";
import type { MarkdownToolData } from "../models/markdown";

const props = defineProps<{
  selectedResult: ToolResult<MarkdownToolData>;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();

const isGeneratingPdf = ref(false);
const pdfError = ref<string | null>(null);
const editableMarkdown = ref(props.selectedResult.data?.markdown || "");

// Check if markdown has been modified
const hasChanges = computed(() => {
  return editableMarkdown.value !== props.selectedResult.data?.markdown;
});

const pdfPath = computed(() => props.selectedResult?.data?.pdfPath || null);

const renderedHtml = computed(() => {
  if (!props.selectedResult.data?.markdown) {
    console.error("No markdown data in result:", props.selectedResult);
    return "";
  }
  // console.log("Rendering markdown:", props.selectedResult.data.markdown);
  return marked(props.selectedResult.data.markdown);
});

// Generate PDF when component mounts with markdown
watch(
  () => props.selectedResult?.data?.markdown,
  async (markdown) => {
    if (
      !markdown ||
      props.selectedResult?.data?.pdfPath ||
      isGeneratingPdf.value ||
      !props.selectedResult
    )
      return;

    try {
      const pdfFeature = await fetch("/api/check-pdf", { method: "GET" });
      const pdfResult = await pdfFeature.json();
      if (!pdfResult.available) {
        return;
      }
    } catch (error) {
      console.error("PDF feature check exception:", error);
      return;
    }

    isGeneratingPdf.value = true;
    pdfError.value = null;

    try {
      const pdfResponse = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          markdown,
          title: props.selectedResult.title || "Document",
          uuid: props.selectedResult.uuid,
        }),
      });

      if (pdfResponse.ok) {
        const pdfResult = await pdfResponse.json();

        // Update the result with pdfPath and notify parent
        const updatedResult: ToolResult = {
          ...props.selectedResult,
          data: {
            ...props.selectedResult.data,
            pdfPath: pdfResult.pdfPath,
          },
        };
        emit("updateResult", updatedResult);
      } else {
        const error = await pdfResponse.json();
        pdfError.value =
          error.details || error.error || "Failed to generate PDF";
        console.error("PDF generation failed:", pdfError.value);
      }
    } catch (error) {
      pdfError.value = error instanceof Error ? error.message : "Unknown error";
      console.error("PDF generation exception:", error);
    } finally {
      isGeneratingPdf.value = false;
    }
  },
  { immediate: true },
);

// Watch for scroll requests from viewState
watch(
  () => props.selectedResult?.viewState?.scrollToAnchor as string | undefined,
  (anchorId) => {
    if (!anchorId) return;

    // Use nextTick to ensure the DOM is updated
    nextTick(() => {
      const element = document.getElementById(anchorId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        console.warn(`Anchor element with id "${anchorId}" not found`);
      }
    });
  },
);

const downloadMarkdown = () => {
  if (!props.selectedResult?.data?.markdown) return;

  const blob = new Blob([props.selectedResult.data.markdown], {
    type: "text/markdown",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const filename = props.selectedResult.title
    ? `${props.selectedResult.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`
    : "document.md";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadPdf = async () => {
  if (!pdfPath.value) return;

  try {
    const response = await fetch("/api/download-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdfPath: pdfPath.value,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to download PDF");
    }

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get("Content-Disposition");
    const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
    const filename = filenameMatch ? filenameMatch[1] : "document.pdf";

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("PDF download failed:", error);
    alert(
      `Failed to download PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

function handleMarkdownEdit() {
  // Just update the local state, don't apply yet
  // User needs to click "Apply Changes" button
}

function applyMarkdown() {
  // Update the result with new markdown content
  const updatedResult: ToolResult<MarkdownToolData> = {
    ...props.selectedResult,
    data: {
      ...props.selectedResult.data,
      markdown: editableMarkdown.value,
      // Reset pdfPath since markdown has changed
      pdfPath: undefined,
    },
  };

  emit("updateResult", updatedResult);

  // The renderedHtml will be updated automatically via computed property
  // and PDF will be regenerated via the existing watch
}

// Watch for external changes to selectedResult (when user clicks different result)
watch(
  () => props.selectedResult.data?.markdown,
  (newMarkdown) => {
    editableMarkdown.value = newMarkdown || "";
  },
);
</script>

<style scoped>
.markdown-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.markdown-content-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.markdown-content :deep(h1) {
  font-size: 2rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h2) {
  font-size: 1.75rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h3) {
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h4) {
  font-size: 1.25rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h5) {
  font-size: 1.125rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h6) {
  font-size: 1rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.markdown-source {
  padding: 0.5rem;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  font-family: monospace;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.markdown-source summary {
  cursor: pointer;
  user-select: none;
  padding: 0.5rem;
  background: #e8e8e8;
  border-radius: 4px;
  font-weight: 500;
  color: #333;
}

.markdown-source[open] summary {
  margin-bottom: 0.5rem;
}

.markdown-source summary:hover {
  background: #d8d8d8;
}

.markdown-editor {
  width: 100%;
  height: 40vh;
  padding: 1rem;
  background: #ffffff;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #333;
  font-family: "Courier New", monospace;
  font-size: 0.9rem;
  resize: vertical;
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.markdown-editor:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.apply-btn {
  padding: 0.5rem 1rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
  font-weight: 500;
}

.apply-btn:hover {
  background: #45a049;
}

.apply-btn:active {
  background: #3d8b40;
}

.apply-btn:disabled {
  background: #cccccc;
  color: #666666;
  cursor: not-allowed;
  opacity: 0.6;
}

.apply-btn:disabled:hover {
  background: #cccccc;
}
</style>
