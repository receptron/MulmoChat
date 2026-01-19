import type { ToolContext, ToolResult } from "gui-chat-protocol/vue";
import type { ToolPlugin } from "../types";
import Present3DView from "../views/present3D.vue";
import Present3DPreview from "../previews/present3D.vue";

const toolName = "present3D";

export interface Present3DToolData {
  script: string;
}

export interface Present3DArgs {
  title: string;
  script: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Display interactive 3D visualizations using the full ShapeScript language with expressions, variables, control flow, and functions.",
  parameters: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Title for the 3D visualization",
      },
      script: {
        type: "string",
        description: `ShapeScript code defining the 3D scene. Full language features supported.

## SYNTAX OVERVIEW:

### Expressions & Operators:
- Arithmetic: +, -, *, /, % with proper precedence
- Comparison: =, <>, <, <=, >, >=
- Boolean: and, or, not
- Parentheses for grouping: (2 + 3) * 4

### Variables:
define radius 2
define red (1 0 0)
sphere { size radius color red }

### Control Flow:

For loops with variables:
for i in 1 to 5 {
    cube { position (i * 2) 0 0 size 1 }
}

For loops with step:
for i in 0 to 10 step 2 {
    sphere { position 0 i 0 }
}

If/else conditionals:
define showSphere 1
if showSphere {
    sphere { size 2 }
} else {
    cube { size 2 }
}

Switch statements:
define shape 2
switch shape {
case 1
    cube
case 2
    sphere
else
    cone
}

### Built-in Functions:

Math: round, floor, ceil, abs, sign, sqrt, pow, min, max
Trig: sin, cos, tan, asin, acos, atan, atan2 (uses radians)
Vector: dot, cross, length, normalize, sum

IMPORTANT: Function calls require NO space between name and parenthesis:
- sin(x) ✓ function call
- sin (x) ✗ NOT a function call (identifier + parenthesized expression)

Examples:
for i in 1 to 8 {
    define angle (i * 0.785)  // 45 degrees in radians
    cube { position (cos(angle) * 3) 0 (sin(angle) * 3) }
}

### Primitives & Properties:

Shapes: cube, sphere, cylinder, cone, torus
Properties: position X Y Z, rotation X Y Z, size X Y Z
Materials: color R G B (0-1), opacity (0-1)

### CSG Operations:
union, difference, intersection, xor, stencil

Example:
difference {
    sphere { size 2 color (1 0.5 0) }
    cube { size 1.5 }
}

### Comments:
// Single-line comment
/* Multi-line
   comment */

## COMPLETE EXAMPLES:

Linear arrangement with expressions:
define spacing 1.5
for i in 1 to 4 {
    cylinder { position ((i - 2.5) * spacing) 0 0 size 0.4 1 }
}

Circular pattern:
define count 12
for i in 1 to count {
    define angle ((i / count) * 6.283)  // 2 * PI
    cube {
        position (cos(angle) * 3) 0 (sin(angle) * 3)
        color (i / count) 0.5 (1 - i / count)
        size 0.5
    }
}

Conditional geometry:
define makeHollow 1
if makeHollow {
    difference {
        sphere { size 2 color (1 0 0) }
        sphere { size 1.7 }
    }
} else {
    sphere { size 2 color (1 0 0) }
}

Mathematical visualization:
for x in -5 to 5 {
    for z in -5 to 5 {
        define height (sin(x * 0.5) * cos(z * 0.5) * 2)
        cube {
            position (x * 0.3) height (z * 0.3)
            size 0.25 (abs(height) + 0.1) 0.25
            color (0.5 + height * 0.25) 0.3 (0.5 - height * 0.25)
        }
    }
}`,
      },
    },
    required: ["title", "script"],
  },
};

const present3D = async (
  context: ToolContext,
  args: Present3DArgs,
): Promise<ToolResult<Present3DToolData>> => {
  const { script, title } = args;

  // Validate that script is provided
  if (!script || script.trim() === "") {
    throw new Error("ShapeScript code is required but was not provided");
  }

  return {
    message: `Created 3D visualization: ${title}`,
    title,
    data: { script },
    instructions:
      "Acknowledge that the 3D visualization has been created and is displayed to the user. They can interact with it by rotating, zooming, and panning the camera.",
  };
};

export const plugin: ToolPlugin<Present3DToolData, unknown, Present3DArgs> = {
  toolDefinition,
  execute: present3D,
  generatingMessage: "Creating 3D visualization...",
  waitingMessage:
    "Tell the user that the 3D visualization was created and will be presented shortly.",
  isEnabled: () => true,
  viewComponent: Present3DView,
  previewComponent: Present3DPreview,
  systemPrompt: `Use the ${toolName} tool to create interactive 3D visualizations when the user requests:
- 3D models or shapes
- Mathematical visualizations (surfaces, functions, geometric patterns)
- Molecular or atomic structures
- Data visualization in 3D (scatter plots, surface plots)
- Architectural layouts
- Game boards or 3D game states
- Any spatial or geometric concepts

## ShapeScript Language Features (FULL SUPPORT):

### Variables & Expressions:
- Define variables: define radius 2, define spacing 1.5
- Use expressions: position (i * 2) 0 0, size (radius * 1.5)
- Math operators: +, -, *, /, % with proper precedence
- Parentheses for grouping: (2 + 3) * 4

### Control Flow:

For loops with variables (use loop variable in calculations):
for i in 1 to 5 {
    cube { position (i * 2 - 6) 0 0 size 1 }
}

For loops with step:
for i in 0 to 10 step 2 {
    sphere { position 0 i 0 }
}

If/else conditionals:
if x > 0 {
    sphere
} else {
    cube
}

Switch statements for multiple cases

### Built-in Functions:
- Math: round, floor, ceil, abs, sign, sqrt, pow, min, max
- Trig: sin, cos, tan, asin, acos, atan, atan2 (radians!)
- Vector: dot, cross, length, normalize, sum

CRITICAL: Function calls require NO space between name and (
- sin(x) ✓ correct
- sin (x) ✗ wrong - this is NOT a function call!

### Best Practices:
1. Use variables for repeated values
2. Use loop variables (i) for positioning and calculations
3. Use trig functions for circular/spiral patterns
4. Use conditionals for parametric designs
5. Keep code readable with meaningful variable names

### Common Patterns:

Linear arrangement:
for i in 1 to 5 {
    cube { position (i * 2) 0 0 }
}

Circular pattern:
define count 12
for i in 1 to count {
    define angle ((i / count) * 6.283)
    cube { position (cos(angle) * 3) 0 (sin(angle) * 3) }
}

Parametric surface:
for x in -5 to 5 {
    for z in -5 to 5 {
        define y (sin(x * 0.5) * cos(z * 0.5))
        cube { position (x * 0.3) y (z * 0.3) size 0.2 }
    }
}

### Primitives & CSG:
Shapes: cube, sphere, cylinder, cone, torus
CSG: union, difference, intersection, xor, stencil
Properties: position, rotation, size, color, opacity

Keep visualizations clear, well-organized, and leverage the full power of expressions and control flow.`,
};
