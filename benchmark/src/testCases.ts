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
 * Load every test case under prompts/<category>/*.json, in directory order
 */
export function readTestCaseFiles(): TestCase[] {
  const promptsDir = path.join(benchmarkRootDir, "prompts");

  return fs
    .readdirSync(promptsDir)
    .map((category) => path.join(promptsDir, category))
    .filter((categoryPath) => fs.statSync(categoryPath).isDirectory())
    .flatMap((categoryPath) =>
      fs
        .readdirSync(categoryPath)
        .filter((file) => file.endsWith(".json"))
        .map((file) => path.join(categoryPath, file)),
    )
    .map(
      (filePath) => JSON.parse(fs.readFileSync(filePath, "utf-8")) as TestCase,
    );
}
