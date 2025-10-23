<template>
  <div class="w-full h-full overflow-y-auto p-8">
    <div v-if="formData" class="max-w-3xl w-full mx-auto">
      <!-- Form Title -->
      <h2
        v-if="formData.title"
        class="text-gray-900 text-3xl font-bold mb-4 text-center"
      >
        {{ formData.title }}
      </h2>

      <!-- Form Description -->
      <p
        v-if="formData.description"
        class="text-gray-600 text-center mb-8 text-lg"
      >
        {{ formData.description }}
      </p>

      <!-- Error Summary -->
      <div
        v-if="showErrorSummary && fieldErrors.size > 0"
        class="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-6"
        role="alert"
      >
        <h3 class="text-red-800 font-semibold mb-2 flex items-center gap-2">
          <svg
            class="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          Please fix the following errors:
        </h3>
        <ul class="text-red-700 space-y-1">
          <li v-for="[fieldId, error] in fieldErrors" :key="fieldId">
            <a
              :href="`#${fieldId}`"
              @click.prevent="focusField(fieldId)"
              class="hover:underline cursor-pointer"
            >
              {{ error.message }}
            </a>
          </li>
        </ul>
      </div>

      <!-- Form Fields -->
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div
          v-for="field in formData.fields"
          :key="field.id"
          :id="field.id"
          class="form-field"
          :class="{ 'has-error': hasError(field.id) && touched.has(field.id) }"
        >
          <!-- Field Label -->
          <label
            :for="`input-${field.id}`"
            class="block text-gray-800 font-semibold mb-2"
            :class="{
              'text-red-600': hasError(field.id) && touched.has(field.id),
            }"
          >
            {{ field.label }}
            <span
              v-if="field.required"
              class="text-red-500 ml-1"
              aria-label="required"
              >*</span
            >
          </label>

          <!-- Field Description -->
          <p v-if="field.description" class="text-gray-600 text-sm mb-2">
            {{ field.description }}
          </p>

          <!-- Text Field -->
          <input
            v-if="field.type === 'text'"
            :id="`input-${field.id}`"
            v-model="formValues[field.id]"
            type="text"
            :placeholder="field.placeholder"
            :aria-invalid="hasError(field.id) && touched.has(field.id)"
            :aria-describedby="
              hasError(field.id) && touched.has(field.id)
                ? `${field.id}-error`
                : undefined
            "
            @blur="handleBlur(field.id)"
            @input="handleInput(field.id)"
            class="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            :class="{
              'border-red-500 focus:ring-red-500':
                hasError(field.id) && touched.has(field.id),
              'border-gray-300': !hasError(field.id) || !touched.has(field.id),
            }"
          />

          <!-- Textarea Field -->
          <textarea
            v-else-if="field.type === 'textarea'"
            :id="`input-${field.id}`"
            v-model="formValues[field.id]"
            :placeholder="field.placeholder"
            :rows="field.rows || 4"
            :aria-invalid="hasError(field.id) && touched.has(field.id)"
            :aria-describedby="
              hasError(field.id) && touched.has(field.id)
                ? `${field.id}-error`
                : undefined
            "
            @blur="handleBlur(field.id)"
            @input="handleInput(field.id)"
            class="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-y"
            :class="{
              'border-red-500 focus:ring-red-500':
                hasError(field.id) && touched.has(field.id),
              'border-gray-300': !hasError(field.id) || !touched.has(field.id),
            }"
          />

          <!-- Number Field -->
          <input
            v-else-if="field.type === 'number'"
            :id="`input-${field.id}`"
            v-model.number="formValues[field.id]"
            type="number"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            :aria-invalid="hasError(field.id) && touched.has(field.id)"
            :aria-describedby="
              hasError(field.id) && touched.has(field.id)
                ? `${field.id}-error`
                : undefined
            "
            @blur="handleBlur(field.id)"
            @input="handleInput(field.id)"
            class="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            :class="{
              'border-red-500 focus:ring-red-500':
                hasError(field.id) && touched.has(field.id),
              'border-gray-300': !hasError(field.id) || !touched.has(field.id),
            }"
          />

          <!-- Date Field -->
          <input
            v-else-if="field.type === 'date'"
            :id="`input-${field.id}`"
            v-model="formValues[field.id]"
            type="date"
            :min="field.minDate"
            :max="field.maxDate"
            :aria-invalid="hasError(field.id) && touched.has(field.id)"
            :aria-describedby="
              hasError(field.id) && touched.has(field.id)
                ? `${field.id}-error`
                : undefined
            "
            @blur="handleBlur(field.id)"
            @change="handleInput(field.id)"
            class="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            :class="{
              'border-red-500 focus:ring-red-500':
                hasError(field.id) && touched.has(field.id),
              'border-gray-300': !hasError(field.id) || !touched.has(field.id),
            }"
          />

          <!-- Time Field -->
          <input
            v-else-if="field.type === 'time'"
            :id="`input-${field.id}`"
            v-model="formValues[field.id]"
            type="time"
            :aria-invalid="hasError(field.id) && touched.has(field.id)"
            :aria-describedby="
              hasError(field.id) && touched.has(field.id)
                ? `${field.id}-error`
                : undefined
            "
            @blur="handleBlur(field.id)"
            @change="handleInput(field.id)"
            class="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            :class="{
              'border-red-500 focus:ring-red-500':
                hasError(field.id) && touched.has(field.id),
              'border-gray-300': !hasError(field.id) || !touched.has(field.id),
            }"
          />

          <!-- Radio Field -->
          <div
            v-else-if="field.type === 'radio'"
            class="space-y-2"
            role="radiogroup"
            :aria-invalid="hasError(field.id) && touched.has(field.id)"
            :aria-describedby="
              hasError(field.id) && touched.has(field.id)
                ? `${field.id}-error`
                : undefined
            "
          >
            <label
              v-for="(choice, index) in field.choices"
              :key="index"
              class="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
              :class="{
                'border-blue-500 bg-blue-50': formValues[field.id] === index,
                'border-gray-300': formValues[field.id] !== index,
              }"
            >
              <input
                type="radio"
                :name="field.id"
                :value="index"
                v-model="formValues[field.id]"
                @change="handleInput(field.id)"
                @blur="handleBlur(field.id)"
                class="mr-3 h-4 w-4 flex-shrink-0"
              />
              <span class="text-gray-800">{{ choice }}</span>
            </label>
          </div>

          <!-- Dropdown Field -->
          <select
            v-else-if="field.type === 'dropdown'"
            :id="`input-${field.id}`"
            v-model="formValues[field.id]"
            :aria-invalid="hasError(field.id) && touched.has(field.id)"
            :aria-describedby="
              hasError(field.id) && touched.has(field.id)
                ? `${field.id}-error`
                : undefined
            "
            @blur="handleBlur(field.id)"
            @change="handleInput(field.id)"
            class="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-white"
            :class="{
              'border-red-500 focus:ring-red-500':
                hasError(field.id) && touched.has(field.id),
              'border-gray-300': !hasError(field.id) || !touched.has(field.id),
            }"
          >
            <option :value="null" disabled>Select an option...</option>
            <option
              v-for="(choice, index) in field.choices"
              :key="index"
              :value="index"
            >
              {{ choice }}
            </option>
          </select>

          <!-- Checkbox Field -->
          <div
            v-else-if="field.type === 'checkbox'"
            class="space-y-2"
            role="group"
            :aria-invalid="hasError(field.id) && touched.has(field.id)"
            :aria-describedby="
              hasError(field.id) && touched.has(field.id)
                ? `${field.id}-error`
                : undefined
            "
          >
            <label
              v-for="(choice, index) in field.choices"
              :key="index"
              class="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
              :class="{
                'border-blue-500 bg-blue-50': (
                  formValues[field.id] || []
                ).includes(index),
                'border-gray-300': !(formValues[field.id] || []).includes(
                  index,
                ),
              }"
            >
              <input
                type="checkbox"
                :value="index"
                v-model="formValues[field.id]"
                @change="handleInput(field.id)"
                @blur="handleBlur(field.id)"
                class="mr-3 h-4 w-4 flex-shrink-0"
              />
              <span class="text-gray-800">{{ choice }}</span>
            </label>
          </div>

          <!-- Error Message -->
          <div
            v-if="hasError(field.id) && touched.has(field.id)"
            :id="`${field.id}-error`"
            class="flex items-center gap-2 mt-2 text-red-600 text-sm"
            role="alert"
          >
            <svg
              class="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            {{ fieldErrors.get(field.id)?.message }}
          </div>

          <!-- Character Count (for text/textarea with maxLength) -->
          <div
            v-if="showCharCount(field)"
            class="text-sm mt-2"
            :class="{
              'text-amber-600 font-semibold': isNearLimit(field),
              'text-gray-500': !isNearLimit(field),
            }"
          >
            {{ (formValues[field.id] || "").length }}
            <span v-if="field.maxLength"> / {{ field.maxLength }}</span>
            characters
          </div>
        </div>

        <!-- Submit Button -->
        <div class="mt-8 flex justify-center">
          <button
            type="submit"
            :disabled="submitted"
            :class="
              submitted
                ? 'bg-green-600 cursor-default'
                : 'bg-blue-600 hover:bg-blue-700'
            "
            class="px-8 py-3 rounded-lg text-white font-semibold text-lg transition-colors"
          >
            {{ submitted ? "✓ Submitted" : "Submit Form" }}
          </button>
        </div>

        <!-- Progress Indicator -->
        <div class="mt-4 text-center text-gray-600 text-sm">
          {{ filledRequiredCount }} / {{ requiredFieldsCount }} required fields
          completed
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { ToolResult } from "../types";
import type {
  FormData,
  FormField,
  TextField,
  TextareaField,
  NumberField,
  DateField,
  CheckboxField,
} from "../models/form";

interface FieldError {
  fieldId: string;
  message: string;
  type: "required" | "format" | "range" | "pattern" | "custom";
}

interface FormViewState {
  userResponses: Record<string, any>;
  touched: string[];
  submitted?: boolean;
}

const props = defineProps<{
  selectedResult: ToolResult | null;
  sendTextMessage: (text?: string) => void;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();

const formData = ref<FormData | null>(null);
const formValues = ref<Record<string, any>>({});
const touched = ref<Set<string>>(new Set());
const fieldErrors = ref<Map<string, FieldError>>(new Map());
const submitted = ref<boolean>(false);
const showErrorSummary = ref<boolean>(false);
const isRestoring = ref<boolean>(false);

// Initialize form data and restore state
watch(
  () => props.selectedResult,
  (newResult, oldResult) => {
    if (newResult?.toolName === "createForm" && newResult.jsonData) {
      // Only restore if this is a different result (uuid changed) or first load
      const isNewResult = !oldResult || oldResult.uuid !== newResult.uuid;

      if (isNewResult) {
        isRestoring.value = true;
        formData.value = newResult.jsonData as FormData;

        // Initialize formValues for all fields
        formValues.value = {};
        formData.value.fields.forEach((field) => {
          formValues.value[field.id] = getDefaultValue(field);
        });

        // Restore from viewState if available
        if (newResult.viewState) {
          const viewState = newResult.viewState as FormViewState;

          if (viewState.userResponses) {
            Object.assign(formValues.value, viewState.userResponses);
          }

          if (viewState.touched) {
            touched.value = new Set(viewState.touched);
            // Re-validate touched fields
            viewState.touched.forEach((fieldId) => {
              validateField(fieldId);
            });
          }

          if (viewState.submitted !== undefined) {
            submitted.value = viewState.submitted;
          }
        }
        isRestoring.value = false;
      }
    }
  },
  { immediate: true },
);

// Save state to viewState - watch all state changes together
watch(
  [formValues, touched, submitted],
  () => {
    if (isRestoring.value || !props.selectedResult) return;

    const updatedResult: ToolResult = {
      ...props.selectedResult,
      viewState: {
        userResponses: { ...formValues.value },
        touched: Array.from(touched.value),
        submitted: submitted.value,
      },
    };
    emit("updateResult", updatedResult);
  },
  { deep: true },
);

function getDefaultValue(field: FormField): any {
  switch (field.type) {
    case "text":
    case "textarea":
      return "";
    case "number":
      return (field as NumberField).min !== undefined
        ? (field as NumberField).min
        : 0;
    case "date":
    case "time":
      return "";
    case "radio":
    case "dropdown":
      return null;
    case "checkbox":
      return [];
    default:
      return null;
  }
}

function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
}

function getErrorMessage(field: FormField, value: any): string | null {
  // Required field validation
  if (field.required && isEmpty(value)) {
    return `${field.label} is required`;
  }

  // Skip other validations if field is empty and not required
  if (isEmpty(value)) {
    return null;
  }

  // Type-specific validations
  switch (field.type) {
    case "text": {
      const textField = field as TextField;
      if (textField.validation === "email" && !isValidEmail(value)) {
        return "Please enter a valid email address";
      }
      if (textField.validation === "url" && !isValidUrl(value)) {
        return "Please enter a valid URL";
      }
      if (textField.validation === "phone" && !isValidPhone(value)) {
        return "Please enter a valid phone number";
      }
      if (
        typeof textField.validation === "string" &&
        textField.validation !== "email" &&
        textField.validation !== "url" &&
        textField.validation !== "phone"
      ) {
        try {
          if (!new RegExp(textField.validation).test(value)) {
            return `${field.label} format is invalid`;
          }
        } catch {
          console.warn(`Invalid regex pattern: ${textField.validation}`);
        }
      }
      break;
    }

    case "textarea": {
      const textareaField = field as TextareaField;
      if (textareaField.minLength && value.length < textareaField.minLength) {
        return `Must be at least ${textareaField.minLength} characters (currently ${value.length})`;
      }
      if (textareaField.maxLength && value.length > textareaField.maxLength) {
        return `Must be no more than ${textareaField.maxLength} characters (currently ${value.length})`;
      }
      break;
    }

    case "number": {
      const numberField = field as NumberField;
      if (numberField.min !== undefined && value < numberField.min) {
        return `Must be at least ${numberField.min}`;
      }
      if (numberField.max !== undefined && value > numberField.max) {
        return `Must be no more than ${numberField.max}`;
      }
      break;
    }

    case "date": {
      const dateField = field as DateField;
      if (dateField.minDate && value < dateField.minDate) {
        return `Date must be on or after ${dateField.minDate}`;
      }
      if (dateField.maxDate && value > dateField.maxDate) {
        return `Date must be on or before ${dateField.maxDate}`;
      }
      break;
    }

    case "checkbox": {
      const checkboxField = field as CheckboxField;
      const selectedCount = value?.length || 0;
      if (
        checkboxField.minSelections &&
        selectedCount < checkboxField.minSelections
      ) {
        return `Please select at least ${checkboxField.minSelections} option${checkboxField.minSelections > 1 ? "s" : ""}`;
      }
      if (
        checkboxField.maxSelections &&
        selectedCount > checkboxField.maxSelections
      ) {
        return `Please select no more than ${checkboxField.maxSelections} option${checkboxField.maxSelections > 1 ? "s" : ""}`;
      }
      break;
    }
  }

  return null;
}

function validateField(fieldId: string): boolean {
  const field = formData.value?.fields.find((f) => f.id === fieldId);
  if (!field) return true;

  const value = formValues.value[fieldId];
  const errorMessage = getErrorMessage(field, value);

  if (errorMessage) {
    fieldErrors.value.set(fieldId, {
      fieldId,
      message: errorMessage,
      type: "custom",
    });
    return false;
  } else {
    fieldErrors.value.delete(fieldId);
    return true;
  }
}

function handleBlur(fieldId: string): void {
  touched.value.add(fieldId);
  validateField(fieldId);
}

function handleInput(fieldId: string): void {
  // Real-time validation for fields that are already touched
  if (touched.value.has(fieldId)) {
    validateField(fieldId);
  }
}

function hasError(fieldId: string): boolean {
  return fieldErrors.value.has(fieldId);
}

function focusField(fieldId: string): void {
  const element = document.getElementById(`input-${fieldId}`);
  if (element) {
    element.focus();
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function showCharCount(field: FormField): boolean {
  return (
    (field.type === "text" || field.type === "textarea") &&
    (field as TextField | TextareaField).maxLength !== undefined
  );
}

function isNearLimit(field: FormField): boolean {
  if (field.type !== "text" && field.type !== "textarea") return false;
  const maxLength = (field as TextField | TextareaField).maxLength;
  if (!maxLength) return false;
  const currentLength = (formValues.value[field.id] || "").length;
  return currentLength / maxLength > 0.9;
}

const requiredFieldsCount = computed(() => {
  return formData.value?.fields.filter((f) => f.required).length || 0;
});

const filledRequiredCount = computed(() => {
  if (!formData.value) return 0;
  return formData.value.fields.filter(
    (f) => f.required && !isEmpty(formValues.value[f.id]),
  ).length;
});

function handleSubmit(): void {
  if (submitted.value) return;

  // Mark all fields as touched
  formData.value?.fields.forEach((field) => {
    touched.value.add(field.id);
    validateField(field.id);
  });

  // Check for errors
  if (fieldErrors.value.size > 0) {
    showErrorSummary.value = true;
    // Focus first error field
    const firstErrorFieldId = Array.from(fieldErrors.value.keys())[0];
    focusField(firstErrorFieldId);
    return;
  }

  // Build response object with actual choice values (not indices)
  const responses: Record<string, any> = {};
  formData.value?.fields.forEach((field) => {
    const value = formValues.value[field.id];

    // Convert indices to actual values for choice-based fields
    if (field.type === "radio" || field.type === "dropdown") {
      if (value !== null && value !== undefined) {
        responses[field.id] = field.choices[value];
      } else {
        responses[field.id] = null;
      }
    } else if (field.type === "checkbox") {
      // Convert array of indices to array of values
      responses[field.id] = (value || []).map(
        (idx: number) => field.choices[idx],
      );
    } else {
      responses[field.id] = value;
    }
  });

  const message = JSON.stringify(
    {
      formSubmission: {
        formTitle: formData.value?.title || "Form",
        responses,
      },
    },
    null,
    2,
  );

  submitted.value = true;
  props.sendTextMessage(message);
}
</script>

<style scoped>
.form-field {
  transition: all 0.2s ease;
}

.form-field.has-error {
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}
</style>
