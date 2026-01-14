import Exa from "exa-js";

// 1) Instantiate the client (put EXA_API_KEY in your .env)
const apiKey = process.env.EXA_API_KEY;
const exa = apiKey ? new Exa(apiKey) : null;

export const hasExaApiKey = !!apiKey;

// 2) A small helper that does search + (optionally) pulls contents
export async function exaSearch(
  query: string,
  opts?: {
    numResults?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
    startPublishedDate?: string; // ISO: "2025-01-01"
    endPublishedDate?: string; // ISO
    fetchText?: boolean; // return cleaned article text
    fetchHighlights?: boolean; // return query-relevant highlights
  },
) {
  if (!exa) {
    console.warn("EXA_API_KEY not configured, returning empty results");
    return [];
  }
  const {
    numResults = 10,
    includeDomains,
    excludeDomains,
    startPublishedDate,
    endPublishedDate,
    fetchText = false,
    fetchHighlights = false,
  } = opts ?? {};

  // You can use either `search` (links only) or `searchAndContents` (links + content)
  const method = fetchText || fetchHighlights ? "searchAndContents" : "search";

  const res =
    method === "searchAndContents"
      ? await exa.searchAndContents(query, {
          numResults,
          includeDomains,
          excludeDomains,
          startPublishedDate,
          endPublishedDate,
          // contents retrieval flags:
          text: fetchText ? { maxCharacters: 5000 } : undefined,
          highlights: fetchHighlights || undefined,
        })
      : await exa.search(query, {
          numResults,
          includeDomains,
          excludeDomains,
          startPublishedDate,
          endPublishedDate,
        });

  // Normalize minimal shape for your app:
  return res.results.map((r) => {
    // Extended result type for searchAndContents (highlights and text are optional)
    const result = r as typeof r & { highlights?: string[]; text?: string };
    return {
      id: result.id,
      url: result.url,
      title: result.title,
      score: result.score,
      publishedDate: result.publishedDate,
      author: result.author,
      // present only if you asked for them:
      highlights: result.highlights,
      text: result.text,
    };
  });
}
