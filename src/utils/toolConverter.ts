/**
 * Tool format converter between OpenAI and Google formats
 */

/**
 * Convert OpenAI tool definition to Google function declaration format
 * @param openAITools - Array of OpenAI tool definitions
 * @returns Array of Google function declarations
 */
export function convertToGoogleToolFormat(openAITools: any[]): any[] {
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
      name: tool.name,
      description: tool.description || "",
      parameters: convertJsonSchemaToGoogleFormat(tool.parameters || {}),
    };
  });
}

/**
 * Convert JSON Schema (OpenAI format) to Google's parameter format
 * Google uses similar schema but with some differences
 */
function convertJsonSchemaToGoogleFormat(schema: any): any {
  if (!schema) {
    return { type: "object", properties: {} };
  }

  const converted: any = {
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
function convertPropertySchema(property: any): any {
  const converted: any = {
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
