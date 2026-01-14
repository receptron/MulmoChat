import { ToolPlugin, ToolContext, ToolResult } from "../types";
import PdfView from "../views/pdf.vue";
import PdfPreview from "../previews/pdf.vue";

const toolName = "summarizePDF";

export interface PdfToolData {
  pdfData: string; // base64 encoded PDF data
  fileName: string;
  summary?: string;
}

export interface PdfArgs {
  prompt: string;
}

export interface PdfJsonData {
  fileName: string;
  summary: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Summarize the content of a currently selected PDF file using Claude.",
  parameters: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description:
          "Instructions for Claude on how to summarize or analyze the PDF",
      },
    },
    required: ["prompt"],
  },
};

const summarizePDF = async (
  context: ToolContext,
  args: PdfArgs,
): Promise<ToolResult<PdfToolData, PdfJsonData>> => {
  const { prompt } = args;

  // Get the current PDF data from context
  const currentPdfData = context.currentResult?.data as PdfToolData;

  if (!currentPdfData?.pdfData) {
    return {
      message:
        "No PDF file available to summarize. Please select a PDF file first.",
      instructions:
        "Tell the user that no PDF file is currently selected and they need to upload a PDF file first.",
    };
  }

  try {
    // Call the server API to summarize the PDF
    const response = await fetch("/api/summarize-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        pdfData: currentPdfData.pdfData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to summarize PDF");
    }

    const data = await response.json();
    const summary = data.summary;

    return {
      data: {
        ...currentPdfData,
        summary,
      },
      jsonData: {
        fileName: currentPdfData.fileName,
        summary,
      },
      message: "PDF summarized successfully",
      instructions: `Give the user a brief summary of the PDF.`,
      instructionsRequired: true,
      updating: true,
    };
  } catch (error) {
    console.error("PDF summarization failed", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      message: `PDF summarization failed: ${errorMessage}`,
      instructions: `Tell the user that the PDF summarization failed with error: ${errorMessage}`,
    };
  }
};

export function createUploadedPdfResult(
  pdfData: string,
  fileName: string,
): ToolResult<PdfToolData> {
  return {
    toolName,
    data: { pdfData, fileName },
    message: "",
    title: fileName,
  };
}

export const plugin: ToolPlugin<PdfToolData, PdfJsonData, PdfArgs> = {
  toolDefinition,
  execute: summarizePDF,
  generatingMessage: "Summarizing PDF...",
  uploadMessage:
    "PDF file is available. Call 'summarizePDF' to see its summary",
  isEnabled: (startResponse) => !!startResponse?.hasAnthropicApiKey,
  viewComponent: PdfView,
  previewComponent: PdfPreview,
  fileUpload: {
    acceptedTypes: ["application/pdf"],
    handleUpload: createUploadedPdfResult,
  },
};
