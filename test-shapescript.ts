// Quick test for ShapeScript implementation
// Run with: npx tsx test-shapescript.ts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseShapeScript } from './src/utils/shapescript/parser.js';
import { SceneNode } from './src/utils/shapescript/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examplesDir = path.join(__dirname, 'src/utils/shapescript/examples');

interface ShapeScriptExample {
  name: string;
  file: string;
  script: string;
  lines: number;
}

interface TestResult {
  example: ShapeScriptExample;
  success: boolean;
  nodes?: SceneNode[];
  error?: Error;
  parseTime?: number;
}

// Read all .shape files from the examples directory
function loadExamples(): ShapeScriptExample[] {
  const files = fs.readdirSync(examplesDir);
  const shapeFiles = files.filter((file) => file.endsWith('.shape'));

  return shapeFiles.map((file) => {
    const filePath = path.join(examplesDir, file);
    const script = fs.readFileSync(filePath, 'utf-8');
    const name = file.replace('.shape', '');

    return {
      name,
      file,
      script,
      lines: script.split('\n').length,
    };
  });
}

// Test parsing a single example
function testExample(example: ShapeScriptExample): TestResult {
  const startTime = performance.now();

  try {
    const nodes = parseShapeScript(example.script);
    const parseTime = performance.now() - startTime;

    return {
      example,
      success: true,
      nodes,
      parseTime,
    };
  } catch (error) {
    const parseTime = performance.now() - startTime;

    return {
      example,
      success: false,
      error: error as Error,
      parseTime,
    };
  }
}

// Count nodes recursively
function countNodes(nodes: SceneNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if ('children' in node && node.children) {
      count += countNodes(node.children);
    }
    if ('body' in node && node.body) {
      count += countNodes(node.body);
    }
    if (node.type === 'if' && node.elseBody) {
      count += countNodes(node.elseBody);
    }
  }
  return count;
}

console.log('ShapeScript Parser Test\n');
console.log('='.repeat(70));
console.log('\nLoading examples from:', examplesDir);

const examples = loadExamples();
console.log(`\nFound ${examples.length} example files\n`);

console.log('Running parser tests...\n');
console.log('='.repeat(70));

const results: TestResult[] = [];

for (const example of examples) {
  const result = testExample(example);
  results.push(result);

  if (result.success) {
    const nodeCount = countNodes(result.nodes!);
    console.log(`✅ ${example.name.padEnd(15)} | ${example.lines.toString().padStart(3)} lines | ${nodeCount.toString().padStart(3)} nodes | ${result.parseTime!.toFixed(2)}ms`);
  } else {
    console.log(`❌ ${example.name.padEnd(15)} | ${example.lines.toString().padStart(3)} lines | FAILED`);
  }
}

console.log('\n' + '='.repeat(70));

// Summary
const passed = results.filter((r) => r.success).length;
const failed = results.filter((r) => !r.success).length;

console.log(`\nSummary: ${passed}/${examples.length} tests passed`);

if (failed > 0) {
  console.log('\nFailed tests:\n');
  for (const result of results.filter((r) => !r.success)) {
    console.log(`\n${result.example.name} (${result.example.file}):`);
    console.log(`Error: ${result.error!.message}`);
    if (result.error && 'line' in result.error && 'column' in result.error) {
      const error = result.error as any;
      console.log(`Location: line ${error.line}, column ${error.column}`);
    }
  }
} else {
  console.log('\n✨ All tests passed!');

  // Show statistics
  const totalNodes = results.reduce((sum, r) => sum + (r.nodes ? countNodes(r.nodes) : 0), 0);
  const totalLines = results.reduce((sum, r) => sum + r.example.lines, 0);
  const totalTime = results.reduce((sum, r) => sum + (r.parseTime || 0), 0);

  console.log(`\nStatistics:`);
  console.log(`  Total lines parsed: ${totalLines}`);
  console.log(`  Total AST nodes: ${totalNodes}`);
  console.log(`  Total parse time: ${totalTime.toFixed(2)}ms`);
  console.log(`  Average time per file: ${(totalTime / examples.length).toFixed(2)}ms`);
}
