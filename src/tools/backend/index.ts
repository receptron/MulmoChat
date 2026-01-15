/**
 * Backend API calls for tools/plugins
 */

// Image generation
export {
  generateImageWithBackend,
  generateImageCommon,
  generateImage,
  editImage,
} from "./imageGeneration";

// Browse
export { browseUrl, getTwitterEmbed } from "./browse";
export type { BrowseResponse } from "./browse";

// Exa search
export { searchExa } from "./exa";
export type {
  ExaSearchResult,
  ExaSearchParams,
  ExaSearchResponse,
} from "./exa";

// HTML generation
export { generateHtml } from "./html";
export type { HtmlGenerationParams, HtmlGenerationResponse } from "./html";

// PDF
export { summarizePdf } from "./pdf";
export type { PdfSummarizeParams, PdfSummarizeResponse } from "./pdf";

// Markdown
export { saveImages } from "./markdown";
export type { SaveImagesParams, SaveImagesResponse } from "./markdown";
