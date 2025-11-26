#!/usr/bin/env node
/**
 * CLI Entry Point for Benchmark
 *
 * Provides command-line interface for running benchmarks
 */

import { runBenchmark } from "./runner";
import { checkApiKeys, LLM_MODELS } from "./config";

/**
 * Parse command line arguments
 */
function parseArgs(): {
  command: string;
  modelName?: string;
  category?: string;
  level?: number;
  ids?: string[];
  verbose?: boolean;
  help?: boolean;
} {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { command: "help", help: true };
  }

  const command = args[0];
  const options: any = { command };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--model" || arg === "-m") {
      options.modelName = args[++i];
    } else if (arg === "--category" || arg === "-c") {
      options.category = args[++i];
    } else if (arg === "--level" || arg === "-l") {
      options.level = parseInt(args[++i]);
    } else if (arg === "--ids" || arg === "-i") {
      options.ids = args[++i].split(",");
    } else if (arg === "--quiet" || arg === "-q") {
      options.verbose = false;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
🔧 LLM Spreadsheet Benchmark CLI

USAGE:
  npm run benchmark:llm -- [command] [options]

COMMANDS:
  run          Run benchmark against an LLM model
  check        Check which API keys are available
  list         List available models
  help         Show this help message

RUN OPTIONS:
  --model, -m <name>       Model to test (required)
  --category, -c <name>    Filter by category (basic, statistical, etc.)
  --level, -l <number>     Filter by difficulty level (1-4)
  --ids, -i <id1,id2>      Run specific test case IDs (comma-separated)
  --quiet, -q              Minimal output
  --verbose, -v            Detailed output (default)

AVAILABLE MODELS:
${Object.keys(LLM_MODELS).map((m) => `  - ${m}`).join("\n")}

EXAMPLES:
  # Run full benchmark for GPT-4
  npm run benchmark:llm -- run --model gpt-4

  # Run only basic level tests for Claude
  npm run benchmark:llm -- run --model claude-3.5-sonnet --level 1

  # Run specific category
  npm run benchmark:llm -- run --model gemini-pro --category statistical

  # Run specific test cases
  npm run benchmark:llm -- run --model gpt-4o --ids basic-01,basic-02

  # Check API keys
  npm run benchmark:llm -- check

ENVIRONMENT VARIABLES:
  Required API keys (set in .env file):
  - OPENAI_API_KEY      For OpenAI models (gpt-4, gpt-4o)
  - ANTHROPIC_API_KEY   For Anthropic models (claude-3.5-sonnet, etc.)
  - GEMINI_API_KEY      For Google models (gemini-pro)

RESULTS:
  Results are automatically saved to benchmark/results/<model-name>/
  Each run creates a timestamped JSON file with detailed metrics.
`);
}

/**
 * Check and display API key status
 */
function checkKeys(): void {
  console.log("\n🔑 API Key Status\n");
  const { available, missing } = checkApiKeys();

  if (available.length > 0) {
    console.log("✓ Available:");
    available.forEach((key) => console.log(`  - ${key}`));
  }

  if (missing.length > 0) {
    console.log("\n✗ Missing:");
    missing.forEach((key) => console.log(`  - ${key}`));
    console.log("\nSet missing API keys in .env file to enable those models.");
  }

  if (available.length === 0) {
    console.log(
      "⚠️  No API keys found. Please set at least one API key in .env file.",
    );
    process.exit(1);
  }
}

/**
 * List available models
 */
function listModels(): void {
  console.log("\n📋 Available Models\n");
  const { available } = checkApiKeys();

  for (const [name, config] of Object.entries(LLM_MODELS)) {
    const providerName =
      config.provider === "openai"
        ? "OpenAI"
        : config.provider === "anthropic"
          ? "Anthropic"
          : "Google";

    const isAvailable = available.includes(providerName);
    const status = isAvailable ? "✓" : "✗";

    console.log(`${status} ${name.padEnd(20)} (${providerName} ${config.model})`);
  }

  console.log(
    "\n💡 Run 'npm run benchmark:llm -- check' to see which API keys are configured.",
  );
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help || options.command === "help") {
    printHelp();
    return;
  }

  if (options.command === "check") {
    checkKeys();
    return;
  }

  if (options.command === "list") {
    listModels();
    return;
  }

  if (options.command === "run") {
    if (!options.modelName) {
      console.error("❌ Error: --model is required for 'run' command");
      console.log("\nRun 'npm run benchmark:llm -- help' for usage information.");
      process.exit(1);
    }

    if (!LLM_MODELS[options.modelName]) {
      console.error(`❌ Error: Unknown model '${options.modelName}'`);
      console.log(
        `\nAvailable models: ${Object.keys(LLM_MODELS).join(", ")}`,
      );
      process.exit(1);
    }

    try {
      await runBenchmark(options.modelName, {
        category: options.category,
        level: options.level,
        ids: options.ids,
        verbose: options.verbose !== false,
        saveResults: true,
      });
    } catch (error) {
      console.error(
        `\n❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }

    return;
  }

  console.error(`❌ Unknown command: ${options.command}`);
  console.log("\nRun 'npm run benchmark:llm -- help' for usage information.");
  process.exit(1);
}

// Run CLI
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
