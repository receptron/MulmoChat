/**
 * Backend API calls for exa plugin
 */

import { postJson } from "./postJson";

export interface ExaSearchResult {
  id: string;
  url: string;
  title: string;
  score: number;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  text?: string;
}

export interface ExaSearchParams {
  query: string;
  numResults?: number;
  includeText?: boolean;
  fetchHighlights?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
}

export interface ExaSearchResponse {
  success: boolean;
  results?: ExaSearchResult[];
  error?: string;
}

export async function searchExa(
  params: ExaSearchParams,
): Promise<ExaSearchResponse> {
  return postJson("/api/exa-search", {
    query: params.query,
    numResults: Math.min(params.numResults || 5, 10),
    includeText: params.includeText ?? true,
    fetchHighlights: params.fetchHighlights ?? false,
    includeDomains: params.includeDomains,
    excludeDomains: params.excludeDomains,
    startPublishedDate: params.startPublishedDate,
    endPublishedDate: params.endPublishedDate,
  });
}
