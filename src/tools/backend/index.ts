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
export { fetchBrowse, fetchTwitterEmbed } from "./browse";
export type { BrowseResponse } from "./browse";

// Exa search
export { fetchExaSearch } from "./exa";
export type {
  ExaSearchResult,
  ExaSearchParams,
  ExaSearchResponse,
} from "./exa";

// HTML generation
export { fetchGenerateHtml } from "./html";
export type { HtmlGenerationParams, HtmlGenerationResponse } from "./html";

// PDF
export { fetchSummarizePdf } from "./pdf";
export type { PdfSummarizeParams, PdfSummarizeResponse } from "./pdf";

// Markdown
export { fetchSaveImages } from "./markdown";
export type { SaveImagesParams, SaveImagesResponse } from "./markdown";
