import { ToolPlugin, ToolContext, ToolResult } from "../types";
import CalculatorView from "../views/calculator.vue";
import CalculatorPreview from "../previews/calculator.vue";
import { create, all } from "mathjs";

const toolName = "calculator";

// Create a math.js instance with all functions
const math = create(all);

export interface CalculatorToolData {
  expression: string;
  result: string | number;
  error?: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Evaluate mathematical expressions and perform calculations. Supports basic arithmetic, advanced math functions (sqrt, sin, cos, log, etc.), and complex expressions.",
  parameters: {
    type: "object" as const,
    properties: {
      expression: {
        type: "string",
        description:
          "The mathematical expression to evaluate. Examples: '2 + 2', 'sqrt(16)', 'sin(pi/2)', '(10 * 5) + 3^2'",
      },
    },
    required: ["expression"],
  },
};

const calculateExpression = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<CalculatorToolData>> => {
  const { expression } = args;

  if (!expression || typeof expression !== "string") {
    return {
      message: "Invalid expression",
      data: {
        expression: "",
        result: "Error",
        error: "Expression is required",
      },
      instructions: "Tell the user that a valid expression is required.",
    };
  }

  try {
    // Evaluate the expression using math.js
    const result = math.evaluate(expression);

    // Format the result
    let formattedResult: string | number;
    if (typeof result === "number") {
      // Round to reasonable precision for display
      formattedResult =
        Math.abs(result) < 1e10 && Math.abs(result) > 1e-10
          ? Math.round(result * 1e10) / 1e10
          : result;
    } else {
      formattedResult = String(result);
    }

    return {
      message: `Calculated: ${expression} = ${formattedResult}`,
      data: {
        expression,
        result: formattedResult,
      },
      jsonData: {
        expression,
        result: formattedResult,
      },
      instructions: `Tell the user that ${expression} equals ${formattedResult}.`,
      updating: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      message: `Calculation error: ${errorMessage}`,
      data: {
        expression,
        result: "Error",
        error: errorMessage,
      },
      jsonData: {
        expression,
        error: errorMessage,
      },
      instructions: `Tell the user that there was an error evaluating the expression "${expression}". Error: ${errorMessage}`,
      updating: true,
    };
  }
};

export const plugin: ToolPlugin<CalculatorToolData> = {
  toolDefinition,
  execute: calculateExpression,
  generatingMessage: "Calculating...",
  isEnabled: () => true,
  viewComponent: CalculatorView,
  previewComponent: CalculatorPreview,
  systemPrompt: `When users ask to perform calculations or evaluate mathematical expressions, use the ${toolName} function. This includes basic arithmetic, percentages, roots, trigonometry, and complex mathematical operations.`,
};
