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

IMPORTANT SYNTAX RULES:
- Only use LITERAL NUMBERS (e.g., 1, 2.5, -3.14)
- NO expressions, functions, or variables (e.g., NO cos(), sin(), PI, i*2)
- For loops automatically rotate objects around Y-axis
- Colors use RGB in 0-1 range (e.g., color 1 0 0 for red)

Examples:

Simple sphere:
sphere { color 1 0 0 size 2 }

Multiple objects:
cube { position -2 0 0 color 1 0 0 }
sphere { color 0 1 0 }
cone { position 2 0 0 color 0 0 1 }

Ring pattern (objects automatically rotate around origin):
for i to 12 {
    cube { position 3 0 0 size 0.5 color 1 0.5 0 }
}

Hollow sphere (CSG):
difference {
    sphere { color 1 0.5 0 size 2 }
    sphere { size 1.8 }
}

Supported primitives: cube, sphere, cylinder, cone
Supported CSG: union, difference, intersection, xor
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

CRITICAL ShapeScript Syntax Rules:
- Use ONLY literal numbers (1, 2.5, -3.14) - NO expressions, variables, or functions
- NO math operations (3*2), NO functions (cos, sin, rand, sqrt), NO constants (PI)
- NO variable interpolation - the loop variable 'i' cannot be used in property values
- For loops: ALL objects in the loop get IDENTICAL properties (same color, same size)
- For loops automatically rotate objects around the Y-axis - just set position X Y Z
- Example ring: "for i to 12 { cube { position 3 0 0 color 1 0 0 } }" creates 12 RED cubes in a circle
- For DIFFERENT colors, create objects manually (not in a loop)
- Colors use RGB 0-1 range: color 1 0 0 for red, color 0 1 0 for green

Primitives: cube, sphere, cylinder, cone
Properties: position X Y Z, rotation X Y Z, size X Y Z, color R G B, opacity
CSG operations: difference, union, intersection, xor

Keep visualizations clear and well-organized.`,
};
