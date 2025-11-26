#!/usr/bin/env node
/**
 * Collect latest results from all models
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resultsDir = path.join(__dirname, "results");

const modelResults: any[] = [];

// Get all model directories
const modelDirs = fs.readdirSync(resultsDir).filter(f => {
  const stat = fs.statSync(path.join(resultsDir, f));
  return stat.isDirectory();
});

// For each model, get the latest result file
for (const modelDir of modelDirs) {
  const modelPath = path.join(resultsDir, modelDir);
  const files = fs.readdirSync(modelPath)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(modelPath, f),
      mtime: fs.statSync(path.join(modelPath, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length > 0) {
    const latest = files[0];
    const data = JSON.parse(fs.readFileSync(latest.path, 'utf-8'));

    modelResults.push({
      model: modelDir,
      avgScore: data.summary.averageScore,
      medianScore: data.summary.medianScore,
      passRate: data.summary.passRate,
      perfectRate: data.summary.perfectRate,
      totalTests: data.summary.totalPrompts,
      results: data.results
    });
  }
}

// Sort by average score
modelResults.sort((a, b) => b.avgScore - a.avgScore);

// Print results
console.log("Model Rankings (sorted by average score):\n");
console.log("Rank | Model | Avg | Median | Pass% | Perfect% | Tests");
console.log("-----|-------|-----|--------|-------|----------|------");

modelResults.forEach((m, i) => {
  const rank = i + 1;
  const passPercent = (m.passRate * 100).toFixed(0);
  const perfectPercent = (m.perfectRate * 100).toFixed(0);
  console.log(
    `${rank.toString().padStart(4)} | ${m.model.padEnd(25)} | ${m.avgScore.toString().padStart(4)} | ${m.medianScore.toString().padStart(6)} | ${passPercent.padStart(4)}% | ${perfectPercent.padStart(7)}% | ${m.totalTests}/7`
  );
});

console.log(`\n✓ Total models: ${modelResults.length}`);
