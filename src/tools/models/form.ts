import { ToolPlugin, ToolContext, ToolResult } from "../types";
import FormView from "../views/form.vue";
import FormPreview from "../previews/form.vue";

const toolName = "createForm";

// Field type discriminator
export type FieldType =
  | "text"
  | "textarea"
  | "radio"
  | "dropdown"
  | "checkbox"
  | "date"
  | "time"
  | "number";

// Base field interface
export interface BaseField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required?: boolean;
}

// Specific field interfaces
export interface TextField extends BaseField {
  type: "text";
  placeholder?: string;
  validation?: "email" | "url" | "phone" | string; // string for regex pattern
}

export interface TextareaField extends BaseField {
  type: "textarea";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  rows?: number;
}

export interface RadioField extends BaseField {
  type: "radio";
  choices: string[]; // 2-6 items
}

export interface DropdownField extends BaseField {
  type: "dropdown";
  choices: string[];
  searchable?: boolean;
}

export interface CheckboxField extends BaseField {
  type: "checkbox";
  choices: string[];
  minSelections?: number;
  maxSelections?: number;
}

export interface DateField extends BaseField {
  type: "date";
  minDate?: string;
  maxDate?: string;
  format?: string;
}

export interface TimeField extends BaseField {
  type: "time";
  format?: "12hr" | "24hr";
}

export interface NumberField extends BaseField {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

// Union type for all fields
export type FormField =
  | TextField
  | TextareaField
  | RadioField
  | DropdownField
  | CheckboxField
  | DateField
  | TimeField
  | NumberField;

// Form data interface
export interface FormData {
  title?: string;
  description?: string;
  fields: FormField[];
}

export type FormResult = ToolResult<never, FormData>;

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Create a structured form to collect information from the user. Supports various field types including text input, textarea, multiple choice (radio), dropdown menus, checkboxes, date/time pickers, and number inputs. Each field can have validation rules and help text.",
  parameters: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Optional title for the form (e.g., 'User Registration')",
      },
      description: {
        type: "string",
        description: "Optional description explaining the purpose of the form",
      },
      fields: {
        type: "array",
        description:
          "Array of form fields with various types and configurations",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description:
                "Unique identifier for the field (e.g., 'email', 'birthdate'). This will be the key in the JSON response. Use descriptive camelCase or snake_case names.",
            },
            type: {
              type: "string",
              enum: [
                "text",
                "textarea",
                "radio",
                "dropdown",
                "checkbox",
                "date",
                "time",
                "number",
              ],
              description:
                "Field type: 'text' for short text, 'textarea' for long text, 'radio' for 2-6 choices, 'dropdown' for many choices, 'checkbox' for multiple selections, 'date' for date picker, 'time' for time picker, 'number' for numeric input",
            },
            label: {
              type: "string",
              description: "Field label shown to the user",
            },
            description: {
              type: "string",
              description: "Optional help text explaining the field",
            },
            required: {
              type: "boolean",
              description: "Whether the field is required (default: false)",
            },
            placeholder: {
              type: "string",
              description: "Placeholder text for text/textarea fields",
            },
            validation: {
              type: "string",
              description:
                "For text fields: 'email', 'url', 'phone', or a regex pattern",
            },
            minLength: {
              type: "number",
              description: "Minimum character length for textarea fields",
            },
            maxLength: {
              type: "number",
              description: "Maximum character length for textarea fields",
            },
            rows: {
              type: "number",
              description: "Number of visible rows for textarea (default: 4)",
            },
            choices: {
              type: "array",
              items: { type: "string" },
              description:
                "Array of choices for radio/dropdown/checkbox fields. Radio should have 2-6 choices, dropdown for 7+ choices.",
            },
            searchable: {
              type: "boolean",
              description: "Make dropdown searchable (for large lists)",
            },
            minSelections: {
              type: "number",
              description: "Minimum number of selections for checkbox fields",
            },
            maxSelections: {
              type: "number",
              description: "Maximum number of selections for checkbox fields",
            },
            minDate: {
              type: "string",
              description: "Minimum date (ISO format: YYYY-MM-DD)",
            },
            maxDate: {
              type: "string",
              description: "Maximum date (ISO format: YYYY-MM-DD)",
            },
            format: {
              type: "string",
              description: "Format for time fields: '12hr' or '24hr'",
            },
            min: {
              type: "number",
              description: "Minimum value for number fields",
            },
            max: {
              type: "number",
              description: "Maximum value for number fields",
            },
            step: {
              type: "number",
              description: "Step increment for number fields",
            },
          },
          required: ["id", "type", "label"],
        },
        minItems: 1,
      },
    },
    required: ["fields"],
  },
};

const createForm = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<FormResult> => {
  try {
    const { title, description, fields } = args;

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      throw new Error("At least one field is required");
    }

    // Validate fields
    const fieldIds = new Set<string>();
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      // Check required properties
      if (!field.id || typeof field.id !== "string") {
        throw new Error(`Field ${i + 1} must have a valid 'id' property`);
      }
      if (!field.type || typeof field.type !== "string") {
        throw new Error(`Field ${i + 1} must have a valid 'type' property`);
      }
      if (!field.label || typeof field.label !== "string") {
        throw new Error(`Field ${i + 1} must have a valid 'label' property`);
      }

      // Check for duplicate IDs
      if (fieldIds.has(field.id)) {
        throw new Error(`Duplicate field ID: '${field.id}'`);
      }
      fieldIds.add(field.id);

      // Validate type-specific properties
      switch (field.type) {
        case "text":
        case "textarea":
          // Valid text fields
          if (field.minLength !== undefined && field.maxLength !== undefined) {
            if (field.minLength > field.maxLength) {
              throw new Error(
                `Field '${field.id}': minLength cannot be greater than maxLength`,
              );
            }
          }
          break;

        case "radio":
          if (!Array.isArray(field.choices) || field.choices.length < 2) {
            throw new Error(
              `Field '${field.id}': radio fields must have at least 2 choices`,
            );
          }
          if (field.choices.length > 6) {
            console.warn(
              `Field '${field.id}': radio fields with more than 6 choices should use 'dropdown' type instead`,
            );
          }
          break;

        case "dropdown":
        case "checkbox":
          if (!Array.isArray(field.choices) || field.choices.length < 1) {
            throw new Error(
              `Field '${field.id}': ${field.type} fields must have at least 1 choice`,
            );
          }
          break;

        case "number":
          if (field.min !== undefined && field.max !== undefined) {
            if (field.min > field.max) {
              throw new Error(
                `Field '${field.id}': min cannot be greater than max`,
              );
            }
          }
          break;

        case "date":
          if (field.minDate && field.maxDate) {
            if (field.minDate > field.maxDate) {
              throw new Error(
                `Field '${field.id}': minDate cannot be after maxDate`,
              );
            }
          }
          break;

        case "time":
          // Valid time field
          break;

        default:
          throw new Error(
            `Field '${field.id}': unknown field type '${field.type}'`,
          );
      }

      // Validate checkbox constraints
      if (field.type === "checkbox") {
        if (
          field.minSelections !== undefined &&
          field.maxSelections !== undefined
        ) {
          if (field.minSelections > field.maxSelections) {
            throw new Error(
              `Field '${field.id}': minSelections cannot be greater than maxSelections`,
            );
          }
        }
        if (
          field.maxSelections !== undefined &&
          field.maxSelections > field.choices.length
        ) {
          throw new Error(
            `Field '${field.id}': maxSelections cannot exceed number of choices`,
          );
        }
      }
    }

    const formData: FormData = {
      title,
      description,
      fields,
    };

    const fieldCount = `${fields.length} field${fields.length > 1 ? "s" : ""}`;
    const titleSuffix = title ? `: ${title}` : "";
    const message = `Form created with ${fieldCount}${titleSuffix}`;

    return {
      message,
      jsonData: formData,
      instructions:
        "The form has been presented to the user. Wait for the user to fill out and submit the form. They will send their responses as a JSON message.",
    };
  } catch (error) {
    console.error("ERR: exception\n Form creation error", error);
    return {
      message: `Form error: ${error instanceof Error ? error.message : "Unknown error"}`,
      instructions:
        "Acknowledge that there was an error creating the form and suggest trying again with corrected field definitions.",
    };
  }
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: createForm,
  generatingMessage: "Preparing form...",
  isEnabled: () => true,
  viewComponent: FormView,
  previewComponent: FormPreview,
};
