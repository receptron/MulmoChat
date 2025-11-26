/**
 * Configuration Management
 *
 * Loads configuration from environment variables and provides
 * type-safe access to benchmark settings.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import type { BenchmarkConfig, LLMConfig } from "./types";

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(rootDir, ".env") });

/**
 * Get API key from environment variable
 */
function getApiKey(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${envVar}. Please set it in .env file.`,
    );
  }
  return value;
}

/**
 * Get optional API key (returns undefined if not set)
 */
function getOptionalApiKey(envVar: string): string | undefined {
  return process.env[envVar];
}

/**
 * Default system prompt for spreadsheet generation
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a spreadsheet generation assistant. Your task is to generate spreadsheets using structured JSON format.

IMPORTANT RULES:
1. Always use formulas (starting with =) for calculations. NEVER hard-code calculated values.
2. Use appropriate spreadsheet functions (SUM, AVERAGE, IF, VLOOKUP, etc.)
3. Format numbers appropriately (currency with $, percentages with %, etc.)
4. Include clear labels and headers
5. Organize data logically

Output Format:
{
  "title": "Spreadsheet Title",
  "sheets": [
    {
      "name": "Sheet Name",
      "data": [
        [{"v": "Label", "f": "format"}, {"v": 123, "f": "$#,##0"}],
        [{"v": "Total", "f": "$#,##0"}, {"v": "=SUM(B1:B10)", "f": "$#,##0"}]
      ]
    }
  ]
}

Cell format:
- v: value (can be string, number, or formula starting with =)
- f: format code (optional, e.g., "$#,##0" for currency, "0.00%" for percentage)

Respond ONLY with valid JSON. No additional text or explanation.`;

/**
 * Available LLM model configurations
 */
export const LLM_MODELS: Record<string, Omit<LLMConfig, "apiKey">> = {
  "gpt-4": {
    provider: "openai",
    model: "gpt-4-turbo-preview",
    temperature: 0.0,
    maxTokens: 4000,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
  "gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.0,
    maxTokens: 4000,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
  "claude-3.5-sonnet": {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.0,
    maxTokens: 4000,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
  "claude-3-opus": {
    provider: "anthropic",
    model: "claude-3-opus-20240229",
    temperature: 0.0,
    maxTokens: 4000,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
  "gemini-pro": {
    provider: "google",
    model: "gemini-1.5-pro",
    temperature: 0.0,
    maxTokens: 4000,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
};

/**
 * Get LLM configuration for a model
 * API keys are injected from environment variables
 */
export function getLLMConfig(modelName: string): LLMConfig {
  const config = LLM_MODELS[modelName];
  if (!config) {
    throw new Error(
      `Unknown model: ${modelName}. Available models: ${Object.keys(LLM_MODELS).join(", ")}`,
    );
  }

  let apiKey: string;
  switch (config.provider) {
    case "openai":
      apiKey = getApiKey("OPENAI_API_KEY");
      break;
    case "anthropic":
      apiKey = getApiKey("ANTHROPIC_API_KEY");
      break;
    case "google":
      apiKey = getApiKey("GEMINI_API_KEY");
      break;
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }

  return {
    ...config,
    apiKey,
  };
}

/**
 * Default benchmark configuration
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  models: {}, // Populated dynamically when needed
  verification: {
    tolerance: 0.01,
    timeoutMs: 30000,
  },
  execution: {
    parallel: false, // Sequential by default for rate limiting
    maxConcurrent: 1,
    retryCount: 2,
    retryDelayMs: 1000,
  },
};

/**
 * Sanitize config for logging (removes API keys)
 */
export function sanitizeConfig(config: LLMConfig): Omit<LLMConfig, "apiKey"> {
  const { apiKey, ...sanitized } = config;
  return sanitized;
}

/**
 * Check if all required API keys are available
 */
export function checkApiKeys(): {
  available: string[];
  missing: string[];
} {
  const available: string[] = [];
  const missing: string[] = [];

  const keys = [
    { name: "OpenAI", env: "OPENAI_API_KEY" },
    { name: "Anthropic", env: "ANTHROPIC_API_KEY" },
    { name: "Google", env: "GEMINI_API_KEY" },
  ];

  for (const key of keys) {
    if (getOptionalApiKey(key.env)) {
      available.push(key.name);
    } else {
      missing.push(key.name);
    }
  }

  return { available, missing };
}
