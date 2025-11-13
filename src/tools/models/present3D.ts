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

Examples:

Simple sphere:
sphere { color 1 0 0 size 2 }

Multiple objects:
cube { position -2 0 0 color 1 0 0 }
sphere { color 0 1 0 }
cone { position 2 0 0 color 0 0 1 }

Hollow sphere (CSG):
difference {
    sphere { color 1 0.5 0 }
    sphere { size 0.8 }
}

Ring pattern:
for i to 8 {
    cube { position 3 0 0 size 0.5 }
    rotate 0 1/8 0
}

Supported primitives: cube, sphere, cylinder, cone
Supported CSG: union, difference, intersection, xor
Transforms: position, rotation, size
Materials: color, opacity`,
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

Use ShapeScript syntax which is concise and readable:
- Primitives: cube, sphere, cylinder, cone
- Properties: position, rotation, size, color, opacity
- CSG operations: difference, union, intersection for complex shapes
- Loops: for i to N { ... } for procedural patterns
- Colors use RGB 0-1 range: color 1 0 0 for red

Keep visualizations clear and well-organized. Use appropriate colors and positioning to make the visualization easy to understand.`,
};
