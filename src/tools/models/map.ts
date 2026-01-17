import { ToolPlugin, ToolContext, ToolResult } from "../types";
import MapView from "../views/map.vue";
import MapPreview from "../previews/map.vue";

const toolName = "presentMap";

export interface MapToolData {
  location: string | { lat: number; lng: number };
}

export interface MapArgs {
  location: string;
}

export const plugin: ToolPlugin<MapToolData, unknown, MapArgs> = {
  toolDefinition: {
    type: "function",
    name: toolName,
    description:
      "Show a location on a map by providing a location name or address",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description:
            "The location name, address, or place to show on the map (e.g., 'Seattle', 'Paris, France', '123 Main St, New York')",
        },
      },
      required: ["location"],
    },
  },
  execute: async (
    context: ToolContext,
    args: MapArgs,
  ): Promise<ToolResult<MapToolData>> => {
    const { location } = args;

    if (!location || typeof location !== "string") {
      throw new Error("Location parameter is required and must be a string");
    }

    return {
      message: `Showing ${location} on the map`,
      data: { location },
    };
  },
  generatingMessage: "Loading map...",
  isEnabled: (startResponse) => !!startResponse?.googleMapKey,
  viewComponent: MapView,
  previewComponent: MapPreview,
  backends: ["map"],
};
