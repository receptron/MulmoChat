// The still of an HTML slide (@gui-chat-plugin/sequence 0.3), for makeMovie:
// the slide as it ends up, rendered here and saved as a picture
// (artifacts/images/…), so its beat is an ordinary saved picture.
//
// Not mulmocast's html_tailwind beat. That page runs the HTML's scripts and
// may fetch anything, and has no way to add a policy: the model's HTML
// (written after reading who knows what) could send the slide out from the
// server, where the View's sandboxed iframe can't. And it takes its still as
// the page loads, before the entrance animations have run, when their
// elements are still transparent.
//
// So the page is the package's own (slideHtmlDocument: its CSP runs no script
// but the page's and Tailwind's, and sends nothing out), and this browser
// fetches nothing but Tailwind's file and Google Fonts, as the View's policy
// allows. Every animation is jumped to its end: the still shows the finished
// slide, whatever the animation (the package's, or the model's own
// @keyframes on an element that starts at opacity 0).
import puppeteer, { type Browser } from "puppeteer";
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  slideHtmlDocument,
} from "@gui-chat-plugin/sequence";
import { saveImage } from "./imageStore";
import { errorMessageOf } from "../utils/imageGenerationError";
import { logger } from "../utils/logger";

// Zero-length animations, filled both ways: each element takes its last
// keyframe at once. One iteration, so an endless one ends too. Typed, so the
// page's check for Tailwind's stylesheet (a <style> without a type) doesn't
// take it for that.
const FINISHED_STYLE =
  '<style type="text/css">*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; animation-fill-mode: both !important; transition: none !important; }</style>';

const GOOGLE_FONTS = [
  "https://fonts.googleapis.com/",
  "https://fonts.gstatic.com/",
];

/** The page for the still: the package's, with animations finished. */
function stillPage(html: string): { page: string; tailwind: string | null } {
  const page = slideHtmlDocument(html).replace(
    "</head>",
    `${FINISHED_STYLE}\n</head>`,
  );
  // The one script file the page loads (the package pins it).
  const tailwind = /<script[^>]*\ssrc="(https:\/\/[^"]+)"/.exec(page)?.[1];
  return { page, tailwind: tailwind ?? null };
}

/** Renders HTML slides to saved pictures, with one browser for all of them. */
export async function withSlideStills<T>(
  use: (still: (html: string) => Promise<string | Error>) => Promise<T>,
): Promise<T> {
  // Launched by the first slide; a holder, as it is set inside the callback.
  const opened: { browser?: Browser } = {};
  try {
    return await use(async (html) => {
      try {
        opened.browser ??= await puppeteer.launch({ headless: true });
        return await renderStill(opened.browser, html);
      } catch (error) {
        logger.warn("HTML slide still failed", {
          error: errorMessageOf(error),
        });
        return new Error(
          `an HTML slide couldn't be rendered: ${errorMessageOf(error)}`,
        );
      }
    });
  } finally {
    await opened.browser?.close();
  }
}

async function renderStill(
  browser: Browser,
  html: string,
): Promise<string | Error> {
  const { page: content, tailwind } = stillPage(html);
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: SLIDE_WIDTH, height: SLIDE_HEIGHT });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      const allowed =
        url === "about:blank" ||
        url.startsWith("data:") ||
        url === tailwind ||
        GOOGLE_FONTS.some((origin) => url.startsWith(origin));
      if (allowed) {
        void request.continue();
      } else {
        void request.abort();
      }
    });
    await page.setContent(content, { waitUntil: "load", timeout: 20_000 });
    // In the page (strings: this file is the server's). Tailwind's styles
    // first: the page shows its body without them after a second, a still
    // that would be unstyled. A slide without them after 10 s (Tailwind
    // unreachable) is taken unstyled, as the View would show it.
    const styled = await page
      .waitForFunction(
        'document.querySelector("style:not([type]):not(#slide-base)")',
        { timeout: 10_000 },
      )
      .then(
        () => true,
        () => false,
      );
    if (!styled) logger.warn("HTML slide still without Tailwind's styles");
    // Then the body shown, its web fonts (Google Fonts) loaded, at most 5 s
    // (a screenshot doesn't wait for them: the text would be missing or
    // wrap differently), and a frame more for the finished animations to be
    // painted.
    await page.waitForFunction(
      'document.documentElement.classList.contains("ready")',
      { timeout: 5_000 },
    );
    await page.evaluate(
      "Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 5000))])",
    );
    await page.evaluate(
      "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    const png = await page.screenshot({ type: "png", encoding: "base64" });
    const imagePath = await saveImage(png);
    return (
      imagePath ?? new Error("the still of an HTML slide couldn't be saved")
    );
  } finally {
    await page.close();
  }
}
