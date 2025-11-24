// Quick test for ShapeScript implementation
// Run with: node test-shapescript.js

const testCases = [
  {
    name: "Basic expressions",
    script: `
      define x 5
      define y (x * 2)
      sphere { size y }
    `,
  },
  {
    name: "For loop with variable",
    script: `
      for i in 1 to 5 {
        cube { position (i * 2) 0 0 size 1 }
      }
    `,
  },
  {
    name: "Trig functions",
    script: `
      define count 8
      for i in 1 to count {
        define angle ((i / count) * 6.283)
        cube { position (cos(angle) * 3) 0 (sin(angle) * 3) }
      }
    `,
  },
  {
    name: "If/else conditional",
    script: `
      define showSphere 1
      if showSphere {
        sphere { size 2 }
      } else {
        cube { size 2 }
      }
    `,
  },
  {
    name: "Switch statement",
    script: `
      define shape 2
      switch shape {
      case 1
        cube
      case 2
        sphere
      else
        cone
      }
    `,
  },
  {
    name: "Nested loops with math",
    script: `
      for x in -2 to 2 {
        for z in -2 to 2 {
          define height (sin(x) * cos(z))
          cube { position (x * 0.5) height (z * 0.5) size 0.3 }
        }
      }
    `,
  },
  {
    name: "Vector operations",
    script: `
      define color1 (1 0 0)
      define color2 (0 1 0)
      sphere { color (color1 * 0.5 + color2 * 0.5) }
    `,
  },
];

console.log("ShapeScript Implementation Test\n");
console.log("=" .repeat(50));

for (const test of testCases) {
  console.log(`\n${test.name}:`);
  console.log(`Script: ${test.script.trim()}`);
  console.log("Status: Ready for testing in browser");
}

console.log("\n" + "=".repeat(50));
console.log("\nAll test cases defined successfully!");
console.log(
  "\nTo test: Start the dev server (npm run dev) and try these scripts",
);
console.log("in the present3D tool through the voice chat interface.");
