/**
 * Backend API calls for PDF plugin
 */

export interface PdfSummarizeParams {
  prompt: string;
  pdfData: string; // base64 encoded PDF
}

export interface PdfSummarizeResponse {
  success: boolean;
  summary?: string;
  error?: string;
}

export async function summarizePdf(
  params: PdfSummarizeParams,
): Promise<PdfSummarizeResponse> {
  const response = await fetch("/api/summarize-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to summarize PDF");
  }

  return response.json();
}
