import { ToolPlugin, ToolContext, ToolResult } from "../types";
import WeatherView from "../views/weather.vue";
import WeatherPreview from "../previews/weather.vue";

const toolName = "fetchWeather";

export interface WeatherToolData {
  areaCode: string;
  areaName: string;
  publishingOffice?: string;
  reportDatetime?: string;
}

export interface WeatherJsonData {
  publishingOffice?: string;
  reportDatetime?: string;
  timeSeries?: Array<{
    timeDefines: string[];
    areas: Array<{
      area: {
        name: string;
        code?: string;
      };
      weatherCodes?: string[];
      weathers?: string[];
      winds?: string[];
      waves?: string[];
      pops?: string[];
      temps?: string[];
      tempsMin?: string[];
      tempsMinUpper?: string[];
      tempsMinLower?: string[];
      tempsMax?: string[];
      tempsMaxUpper?: string[];
      tempsMaxLower?: string[];
    }>;
  }>;
  tempAverage?: {
    areas: Array<{
      area: {
        name: string;
        code?: string;
      };
      min?: string;
      max?: string;
    }>;
  };
  precipAverage?: {
    areas: Array<{
      area: {
        name: string;
        code?: string;
      };
      min?: string;
      max?: string;
    }>;
  };
}

export type WeatherResult = ToolResult<WeatherToolData, WeatherJsonData>;

// Area code mapping
const AREA_CODES: Record<string, string> = {
  "130000": "Tokyo",
  "270000": "Osaka",
};

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Fetch weather forecast information from Japan Meteorological Agency (JMA) for a specific area. Currently supports Tokyo (130000) and Osaka (270000).",
  parameters: {
    type: "object" as const,
    properties: {
      areaCode: {
        type: "string",
        description:
          "The area code for the location. Tokyo: 130000, Osaka: 270000",
        enum: ["130000", "270000"],
      },
    },
    required: ["areaCode"],
  },
};

const fetchWeather = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<WeatherResult> => {
  const areaCode = args.areaCode as string;
  const areaName = AREA_CODES[areaCode] || "Unknown";

  try {
    const url = `https://www.jma.go.jp/bosai/forecast/data/forecast/${areaCode}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`JMA API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // JMA API returns an array of forecast data
    // Typically the first element contains the main forecast
    const forecastData = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!forecastData) {
      return {
        message: `No weather data available for ${areaName}`,
        title: `Weather - ${areaName}`,
        instructions: "Acknowledge that no weather data is available for the requested area.",
        data: {
          areaCode,
          areaName,
        },
      };
    }

    return {
      message: `Successfully fetched weather forecast for ${areaName}`,
      title: `Weather - ${areaName}`,
      jsonData: forecastData,
      instructions:
        "Provide a summary of the weather forecast. Include today's weather, temperature range, and any notable conditions. Keep it concise and conversational.",
      data: {
        areaCode,
        areaName,
        publishingOffice: forecastData.publishingOffice,
        reportDatetime: forecastData.reportDatetime,
      },
    };
  } catch (error) {
    console.error("*** Weather fetch failed", error);
    return {
      message: `Failed to fetch weather for ${areaName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      title: `Weather - ${areaName}`,
      instructions: "Acknowledge that the weather data fetch failed and suggest trying again.",
      data: {
        areaCode,
        areaName,
      },
    };
  }
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: fetchWeather,
  generatingMessage: "Fetching weather forecast...",
  waitingMessage: "Tell the user that you are fetching the weather forecast for the specified area.",
  isEnabled: () => true,
  delayAfterExecution: 2000,
  viewComponent: WeatherView,
  previewComponent: WeatherPreview,
  systemPrompt: "When fetching weather, you can provide forecasts for Tokyo (130000) and Osaka (270000). Summarize the weather in a natural, conversational way.",
};
