import { ToolPlugin, ToolContext, ToolResult } from "../types";
import Present3DView from "../views/present3D.vue";
import Present3DPreview from "../previews/present3D.vue";

const toolName = "present3D";

export interface Present3DToolData {
  script: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Display interactive 3D visualizations using ShapeScript language.",
  parameters: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Title for the 3D visualization",
      },
      script: {
        type: "string",
        description: `ShapeScript code defining the 3D scene.

CRITICAL SYNTAX RULES - READ CAREFULLY:
1. ONLY use literal numbers: 1, 2.5, -3.14
2. NO parentheses, NO math operators (+ - * /), NO variables (i), NO functions
3. For loops: ALL objects get IDENTICAL property values
4. For loops automatically rotate objects around Y-axis for circular patterns
5. For objects in different positions, write them manually (NOT in a loop)
6. Comments start with // (e.g., // This is a comment)

WRONG - DO NOT USE:
cylinder { position (i*1.5-2.25) 0 0 }  // ERROR: NO expressions!
cube { size 2+3 1 1 }  // ERROR: NO operators!
sphere { position i 0 0 }  // ERROR: NO variables!

CORRECT EXAMPLES:

Simple objects:
sphere { color 1 0 0 size 2 }
cube { position -2 0 0 color 1 0 0 }

Ring pattern (for loops create circles):
for i to 12 {
    cube { position 3 0 0 size 0.5 color 1 0.5 0 }
}

Objects in a row (write manually, NOT with loops):
cylinder { position -2.25 0 0 size 0.4 1 color 0.8 0.8 0.8 }
cylinder { position -0.75 0 0 size 0.4 1 color 0.8 0.8 0.8 }
cylinder { position 0.75 0 0 size 0.4 1 color 0.8 0.8 0.8 }
cylinder { position 2.25 0 0 size 0.4 1 color 0.8 0.8 0.8 }

CSG operations:
difference {
    sphere { color 1 0.5 0 size 2 }
    sphere { size 1.8 }
}

Primitives: cube, sphere, cylinder, cone, torus
CSG: union, difference, intersection, xor
Transforms: position X Y Z, rotation X Y Z (radians), size X Y Z
Materials: color R G B (0-1), opacity (0-1)`,
      },
    },
    required: ["title", "script"],
  },
};

const present3D = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<Present3DToolData>> => {
  const script = args.script as string;
  const title = args.title as string;

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

export const plugin: ToolPlugin = {
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

CRITICAL ShapeScript Syntax Rules - MUST FOLLOW:
1. ONLY literal numbers allowed: 1, 2.5, -3.14
2. NEVER use: parentheses (), math operators (+ - * /), variables (i), functions (cos, sin, rand)
3. For loops: ALL objects get IDENTICAL properties - same position, same color, same size
4. For loops automatically rotate objects to create circular patterns
5. For objects at different positions: write each one separately (NOT in a loop)
6. Comments start with // (e.g., // Red sphere)

WRONG - NEVER DO THIS:
- cylinder { position (i*1.5-2.25) 0 0 }  // NO expressions!
- cube { size 2+3 1 1 }  // NO operators!
- sphere { position i 0 0 }  // NO variable i!
- for i to 4 { cube { position i 0 0 } }  // NO variable usage!

CORRECT - DO THIS:
- Ring: "for i to 12 { cube { position 3 0 0 color 1 0 0 } }"  (12 identical red cubes in circle)
- Row: Write each cylinder separately with different literal numbers:
  cylinder { position -2.25 0 0 size 0.4 1 }
  cylinder { position -0.75 0 0 size 0.4 1 }
  cylinder { position 0.75 0 0 size 0.4 1 }
  cylinder { position 2.25 0 0 size 0.4 1 }

Primitives: cube, sphere, cylinder, cone, torus
Properties: position X Y Z, rotation X Y Z, size X Y Z, color R G B, opacity
CSG: difference, union, intersection, xor
Colors: RGB 0-1 range (color 1 0 0 = red, color 0 1 0 = green)

Keep visualizations clear and well-organized.`,
};
