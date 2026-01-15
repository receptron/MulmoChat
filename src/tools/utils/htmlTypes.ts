/**
 * Shared HTML type definitions used across multiple plugins
 */

export const HTML_LIBRARIES = [
  "tailwind",
  "d3.js",
  "three.js",
  "p5.js",
  "mermaid",
] as const;

export type HtmlLibraryType = (typeof HTML_LIBRARIES)[number];

export const LIBRARY_DESCRIPTIONS: Record<HtmlLibraryType, string> = {
  tailwind: "Tailwind CSS for utility-first styling",
  "d3.js": "D3.js for data-driven visualizations and interactive charts",
  "three.js": "Three.js for 3D graphics and WebGL rendering",
  "p5.js": "p5.js for creative coding, animations, and generative art",
  mermaid: "Mermaid for diagrams and flowcharts from text definitions",
};

export interface HtmlToolData {
  html: string;
  type: HtmlLibraryType;
}

export interface HtmlArgs {
  title: string;
  html: string;
  type: HtmlLibraryType;
}
