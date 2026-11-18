/**
 * Test case loading shared by the benchmark tools
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { TestCase } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const benchmarkRootDir = path.resolve(__dirname, "..");

/**
 * Every test case under prompts/<category>/*.json, in directory order, read one file at a time
 */
export function* testCaseFiles(): Generator<TestCase> {
  const promptsDir = path.join(benchmarkRootDir, "prompts");

  for (const category of fs.readdirSync(promptsDir)) {
    const categoryPath = path.join(promptsDir, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    for (const file of fs.readdirSync(categoryPath)) {
      if (file.endsWith(".json")) {
        const filePath = path.join(categoryPath, file);
        yield JSON.parse(fs.readFileSync(filePath, "utf-8")) as TestCase;
      }
    }
  }
}

export function readTestCaseFiles(): TestCase[] {
  return [...testCaseFiles()];
}
