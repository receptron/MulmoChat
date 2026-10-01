// The text of a PDF at a URL, for /api/browse. The crawler reads a page's
// HTML, and a PDF opened in Chrome is the PDF viewer's page, with no text in
// it: browsing a company's filing (what a search for its figures finds) came
// back empty. Chrome fetches the file from the page it opened, so a site
// that refuses other clients (ir.tesla.com timed out a plain fetch) serves it
// with the cookies it just set.
import puppeteer from "puppeteer";
import { extractText, getDocumentProxy } from "unpdf";

const isCI = process.env.CI === "true";

/** A filing runs to hundreds of thousands of characters; the model gets the
 *  start, and is told what was left out. */
export const PDF_TEXT_MAX = 40_000;
const PDF_BYTES_MAX = 30 * 1024 * 1024;
const NAVIGATION_TIMEOUT_MS = 30_000;

export interface PdfText {
  title: string;
  text: string;
  pages: number;
  /** The whole text's length, when the text was cut to PDF_TEXT_MAX. */
  fullLength?: number;
}

/** The PDF's text, or null when the URL isn't a PDF. Throws when it is one
 *  but can't be read. */
export async function fetchPdfText(url: string): Promise<PdfText | null> {
  const browser = await puppeteer.launch({
    args: isCI ? ["--no-sandbox"] : [],
  });
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, {
      waitUntil: "load",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    const type = response?.headers()["content-type"] ?? "";
    if (!type.includes("application/pdf")) return null;
    // From where the navigation ended: a URL that redirects to another site
    // (a CDN) would otherwise be fetched cross-origin, and refused. Read as a
    // stream, so a file over the limit is dropped as soon as it passes it.
    const base64 = await page.evaluate(
      async (target, max) => {
        const res = await fetch(target);
        if (Number(res.headers.get("content-length") ?? 0) > max) return null;
        const reader = res.body?.getReader();
        if (!reader) return null;
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > max) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let at = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, at);
          at += chunk.length;
        }
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      },
      response?.url() ?? url,
      PDF_BYTES_MAX,
    );
    if (!base64) throw new Error("The PDF is too large to read");
    const pdf = await getDocumentProxy(
      new Uint8Array(Buffer.from(base64, "base64")),
    );
    const info = await pdf.getMetadata().catch(() => null);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const clean = text
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
    const infoTitle = (info?.info as { Title?: unknown } | undefined)?.Title;
    const title =
      typeof infoTitle === "string" && infoTitle.trim()
        ? infoTitle.trim()
        : decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "PDF");
    return clean.length > PDF_TEXT_MAX
      ? {
          title,
          text: clean.slice(0, PDF_TEXT_MAX),
          pages: totalPages,
          fullLength: clean.length,
        }
      : { title, text: clean, pages: totalPages };
  } finally {
    await browser.close();
  }
}
