import { ToolPlugin, ToolContext, ToolResult } from "../types";
import CurrencyView from "../views/currency.vue";
import CurrencyPreview from "../previews/currency.vue";

const toolName = "convertCurrency";

export interface CurrencyToolData {
  amount: number;
  from: string;
  to: string;
  rate: number;
  result: number;
  timestamp: string;
  error?: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Convert currency amounts between different currencies using current exchange rates.",
  parameters: {
    type: "object" as const,
    properties: {
      amount: {
        type: "number",
        description: "The amount to convert",
      },
      from: {
        type: "string",
        description:
          "Source currency code (e.g., 'USD', 'EUR', 'JPY', 'GBP', 'CNY')",
      },
      to: {
        type: "string",
        description:
          "Target currency code (e.g., 'USD', 'EUR', 'JPY', 'GBP', 'CNY')",
      },
    },
    required: ["amount", "from", "to"],
  },
};

const convertCurrency = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<CurrencyToolData>> => {
  const { amount, from, to } = args;

  if (
    typeof amount !== "number" ||
    !from ||
    typeof from !== "string" ||
    !to ||
    typeof to !== "string"
  ) {
    return {
      message: "Invalid parameters",
      data: {
        amount: 0,
        from: from || "",
        to: to || "",
        rate: 0,
        result: 0,
        timestamp: new Date().toISOString(),
        error: "Amount, from currency, and to currency are required",
      },
      instructions:
        "Tell the user that valid amount and currency codes are required.",
    };
  }

  const fromCurrency = from.toUpperCase();
  const toCurrency = to.toUpperCase();

  try {
    // Use exchangerate-api.com (free tier available)
    const apiUrl = `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Currency API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.rates || !data.rates[toCurrency]) {
      throw new Error(`Currency conversion not available for ${toCurrency}`);
    }

    const rate = data.rates[toCurrency];
    const result = amount * rate;
    const timestamp = data.date || new Date().toISOString();

    return {
      message: `${amount} ${fromCurrency} = ${result.toFixed(2)} ${toCurrency}`,
      data: {
        amount,
        from: fromCurrency,
        to: toCurrency,
        rate,
        result,
        timestamp,
      },
      jsonData: {
        amount,
        fromCurrency,
        toCurrency,
        exchangeRate: rate,
        convertedAmount: result,
        lastUpdated: timestamp,
      },
      instructions: `Tell the user that ${amount} ${fromCurrency} equals ${result.toFixed(2)} ${toCurrency} at an exchange rate of ${rate.toFixed(4)}.`,
      updating: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      message: `Currency conversion error: ${errorMessage}`,
      data: {
        amount,
        from: fromCurrency,
        to: toCurrency,
        rate: 0,
        result: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      },
      instructions: `Tell the user that there was an error converting ${fromCurrency} to ${toCurrency}. Error: ${errorMessage}`,
      updating: true,
    };
  }
};

export const plugin: ToolPlugin<CurrencyToolData> = {
  toolDefinition,
  execute: convertCurrency,
  generatingMessage: "Converting currency...",
  isEnabled: () => true,
  viewComponent: CurrencyView,
  previewComponent: CurrencyPreview,
  systemPrompt: `When users ask to convert currency or compare prices in different currencies, use the ${toolName} function. Common currency codes: USD (US Dollar), EUR (Euro), JPY (Japanese Yen), GBP (British Pound), CNY (Chinese Yuan), CAD (Canadian Dollar), AUD (Australian Dollar).`,
};
