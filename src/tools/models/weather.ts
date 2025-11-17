import { ToolPlugin, ToolContext, ToolResult } from "../types";
import WeatherView from "../views/weather.vue";
import WeatherPreview from "../previews/weather.vue";

const toolName = "getWeather";

export interface WeatherToolData {
  location: string;
  latitude: number;
  longitude: number;
  current: {
    temperature: number;
    weatherCode: number;
    weatherDescription: string;
    windSpeed: number;
    humidity: number;
  };
  daily?: {
    dates: string[];
    temperatureMax: number[];
    temperatureMin: number[];
    weatherCodes: number[];
  };
  error?: string;
}

// Weather code to description mapping (WMO Weather interpretation codes)
const weatherCodeDescriptions: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Get current weather information and forecast for a location using coordinates (latitude/longitude).",
  parameters: {
    type: "object" as const,
    properties: {
      latitude: {
        type: "number",
        description: "Latitude of the location",
      },
      longitude: {
        type: "number",
        description: "Longitude of the location",
      },
      location: {
        type: "string",
        description:
          "Human-readable location name (e.g., 'Tokyo, Japan', 'New York, USA')",
      },
      includeForecast: {
        type: "boolean",
        description:
          "Whether to include 7-day forecast (default: false for current weather only)",
      },
    },
    required: ["latitude", "longitude", "location"],
  },
};

const getWeather = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<WeatherToolData>> => {
  const { latitude, longitude, location, includeForecast = false } = args;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !location
  ) {
    return {
      message: "Invalid parameters",
      data: {
        location: location || "Unknown",
        latitude: 0,
        longitude: 0,
        current: {
          temperature: 0,
          weatherCode: 0,
          weatherDescription: "Error",
          windSpeed: 0,
          humidity: 0,
        },
        error: "Latitude, longitude, and location are required",
      },
      instructions:
        "Tell the user that valid coordinates and location name are required.",
    };
  }

  try {
    // Build API URL for Open-Meteo (free weather API)
    const currentParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current:
        "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
    });

    if (includeForecast) {
      currentParams.append(
        "daily",
        "temperature_2m_max,temperature_2m_min,weather_code",
      );
      currentParams.append("timezone", "auto");
      currentParams.append("forecast_days", "7");
    }

    const apiUrl = `https://api.open-meteo.com/v1/forecast?${currentParams}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    const weatherCode = data.current.weather_code;
    const weatherDescription =
      weatherCodeDescriptions[weatherCode] || "Unknown";

    const weatherData: WeatherToolData = {
      location,
      latitude,
      longitude,
      current: {
        temperature: Math.round(data.current.temperature_2m * 10) / 10,
        weatherCode,
        weatherDescription,
        windSpeed: Math.round(data.current.wind_speed_10m * 10) / 10,
        humidity: data.current.relative_humidity_2m,
      },
    };

    // Add forecast data if requested
    if (includeForecast && data.daily) {
      weatherData.daily = {
        dates: data.daily.time,
        temperatureMax: data.daily.temperature_2m_max.map(
          (t: number) => Math.round(t * 10) / 10,
        ),
        temperatureMin: data.daily.temperature_2m_min.map(
          (t: number) => Math.round(t * 10) / 10,
        ),
        weatherCodes: data.daily.weather_code,
      };
    }

    const forecastText = includeForecast ? " and 7-day forecast" : "";
    const message = `Weather for ${location}: ${weatherData.current.temperature}°C, ${weatherDescription}`;

    return {
      message,
      data: weatherData,
      jsonData: {
        location,
        current: {
          temperature: weatherData.current.temperature,
          condition: weatherDescription,
          windSpeed: weatherData.current.windSpeed,
          humidity: weatherData.current.humidity,
        },
        ...(weatherData.daily && {
          forecast: weatherData.daily.dates.map((date, i) => ({
            date,
            maxTemp: weatherData.daily!.temperatureMax[i],
            minTemp: weatherData.daily!.temperatureMin[i],
            condition:
              weatherCodeDescriptions[weatherData.daily!.weatherCodes[i]] ||
              "Unknown",
          })),
        }),
      },
      instructions: `Tell the user the weather information for ${location}${forecastText}.`,
      updating: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      message: `Weather error: ${errorMessage}`,
      data: {
        location,
        latitude,
        longitude,
        current: {
          temperature: 0,
          weatherCode: 0,
          weatherDescription: "Error",
          windSpeed: 0,
          humidity: 0,
        },
        error: errorMessage,
      },
      instructions: `Tell the user that there was an error getting the weather for ${location}. Error: ${errorMessage}`,
      updating: true,
    };
  }
};

export const plugin: ToolPlugin<WeatherToolData> = {
  toolDefinition,
  execute: getWeather,
  generatingMessage: "Getting weather...",
  isEnabled: () => true,
  viewComponent: WeatherView,
  previewComponent: WeatherPreview,
  systemPrompt: `When users ask about weather or temperature in a location, use the ${toolName} function. You'll need to determine the coordinates (latitude/longitude) for the location first. For major cities, you can use approximate coordinates.`,
};
