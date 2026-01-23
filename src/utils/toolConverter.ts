/**
 * Tool format converter between OpenAI and Google formats
 */

// OpenAI tool definition types
export interface OpenAITool {
  type?: "function";
  function?: {
    name: string;
    description?: string;
    parameters?: JsonSchema;
  };
  // Simplified format fallback
  name?: string;
  description?: string;
  parameters?: JsonSchema;
}

// JSON Schema types (subset used for tool parameters)
interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  enum?: string[];
  items?: JsonSchema;
}

// Google function declaration types
interface GoogleFunctionDeclaration {
  name: string;
  description: string;
  parameters: JsonSchema;
}

/**
 * Convert OpenAI tool definition to Google function declaration format
 * @param openAITools - Array of OpenAI tool definitions
 * @returns Array of Google function declarations
 */
export function convertToGoogleToolFormat(
  openAITools: OpenAITool[],
): GoogleFunctionDeclaration[] {
  if (!openAITools || openAITools.length === 0) {
    return [];
  }

  return openAITools.map((tool) => {
    if (tool.type === "function" && tool.function) {
      return {
        name: tool.function.name,
        description: tool.function.description || "",
        parameters: convertJsonSchemaToGoogleFormat(
          tool.function.parameters || {},
        ),
      };
    }

    // Fallback for tools that are already in the simplified format
    return {
      name: tool.name || "",
      description: tool.description || "",
      parameters: convertJsonSchemaToGoogleFormat(tool.parameters || {}),
    };
  });
}

/**
 * Convert JSON Schema (OpenAI format) to Google's parameter format
 * Google uses similar schema but with some differences
 */
function convertJsonSchemaToGoogleFormat(schema: JsonSchema): JsonSchema {
  if (!schema) {
    return { type: "object", properties: {} };
  }

  const converted: JsonSchema = {
    type: schema.type || "object",
  };

  if (schema.properties) {
    converted.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      converted.properties[key] = convertPropertySchema(value);
    }
  }

  if (schema.required && Array.isArray(schema.required)) {
    converted.required = schema.required;
  }

  if (schema.description) {
    converted.description = schema.description;
  }

  return converted;
}

/**
 * Convert individual property schema
 */
function convertPropertySchema(property: JsonSchema): JsonSchema {
  const converted: JsonSchema = {
    type: property.type,
  };

  if (property.description) {
    converted.description = property.description;
  }

  if (property.enum) {
    converted.enum = property.enum;
  }

  if (property.items) {
    converted.items = convertPropertySchema(property.items);
  }

  if (property.properties) {
    converted.properties = {};
    for (const [key, value] of Object.entries(property.properties)) {
      converted.properties[key] = convertPropertySchema(value);
    }
  }

  if (property.required) {
    converted.required = property.required;
  }

  return converted;
}
