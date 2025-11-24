// Quick test for ShapeScript implementation
// Run with: npx tsx test-shapescript.ts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examplesDir = path.join(__dirname, 'src/utils/shapescript/examples');

interface ShapeScriptExample {
  name: string;
  file: string;
  script: string;
  lines: number;
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

console.log('ShapeScript Implementation Test\n');
console.log('='.repeat(50));
console.log('\nLoading examples from:', examplesDir);

const testCases = loadExamples();

console.log(`\nFound ${testCases.length} example files:\n`);

for (const test of testCases) {
  console.log(`\n${test.name} (${test.file}):`);
  console.log(`Lines: ${test.lines}`);
  console.log(`Preview:\n${test.script.split('\n').slice(0, 10).join('\n')}`);
  if (test.lines > 10) {
    console.log(`... (${test.lines - 10} more lines)`);
  }
  console.log('Status: Ready for testing');
}

console.log('\n' + '='.repeat(50));
console.log(`\nAll ${testCases.length} example files loaded successfully!`);
console.log(
  '\nTo test: Start the dev server (npm run dev) and try these scripts',
);
console.log('in the present3D tool through the voice chat interface.');
