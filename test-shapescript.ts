// Quick test for ShapeScript implementation
// Run with: npx tsx test-shapescript.ts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { parseShapeScript } from './src/utils/shapescript/parser.js';
import { astToThreeJS } from './src/utils/shapescript/toThreeJS.ts';
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

interface TransformTestCase {
  description: string;
  script: string;
  expectedPositions: [number, number, number][];
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

console.log('\nRunning ShapeScript transform regression tests...\n');
runTransformRegressionTests();

function runTransformRegressionTests(): void {
  const tests: TransformTestCase[] = [
    {
      description: 'rotate then translate uses rotated axes',
      script: `
        rotate 0 0 0.25
        translate 1 0 0
        cube
      `,
      expectedPositions: [[0, 1, 0]],
    },
    {
      description: 'scale affects subsequent translations',
      script: `
        scale 0.5
        translate 2 0 0
        cube
      `,
      expectedPositions: [[1, 0, 0]],
    },
    {
      description: 'absolute position composes with relative translate',
      script: `
        translate 1 0 0
        cube { position 1 0 0 }
      `,
      expectedPositions: [[2, 0, 0]],
    },
  ];

  let passed = 0;

  for (const test of tests) {
    try {
      const nodes = parseShapeScript(test.script);
      const group = astToThreeJS(nodes);
      const positions = collectMeshPositions(group);

      if (positions.length < test.expectedPositions.length) {
        throw new Error(
          `Expected at least ${test.expectedPositions.length} meshes, found ${positions.length}`,
        );
      }

      const allMatch = test.expectedPositions.every((expected, index) =>
        vectorsAlmostEqual(positions[index], new THREE.Vector3(...expected)),
      );

      if (allMatch) {
        passed++;
        console.log(`✅ ${test.description}`);
      } else {
        console.log(`❌ ${test.description} (unexpected positions)`);
        positions.forEach((pos, idx) => {
          console.log(
            `  Mesh ${idx}: (${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}, ${pos.z.toFixed(4)})`,
          );
        });
      }
    } catch (error) {
      console.log(`❌ ${test.description}`);
      console.log(`   ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\nTransform tests: ${passed}/${tests.length} passed`);
}

function collectMeshPositions(root: THREE.Object3D): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      positions.push(object.position.clone());
    }
  });
  return positions;
}

function vectorsAlmostEqual(a: THREE.Vector3, b: THREE.Vector3, epsilon = 1e-6): boolean {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.z - b.z) <= epsilon
  );
}
