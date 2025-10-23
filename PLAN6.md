# PLAN6: Form Plugin Implementation

## Overview
Create a rich, structured form plugin that extends beyond the quiz plugin's simple multiple choice format. This plugin will support various field types including text input, dates, times, and dropdown menus, with structured JSON output.

## Goals
1. Support multiple field types for diverse data collection needs
2. Provide clear field descriptions to guide users
3. Generate structured JSON output for easy processing
4. Integrate seamlessly with the existing plugin architecture
5. Deliver excellent UX through dedicated Vue components

## Field Types

### 1. Text Field
- **Use case**: Short text input (name, email, single-line responses)
- **Properties**:
  - `label`: Field label (required)
  - `description`: Optional help text
  - `placeholder`: Optional placeholder text
  - `required`: Boolean flag
  - `validation`: Optional regex pattern or validation type (email, url, etc.)

### 2. Textarea Field
- **Use case**: Long-form text input (comments, descriptions, paragraphs)
- **Properties**:
  - `label`: Field label (required)
  - `description`: Optional help text
  - `placeholder`: Optional placeholder text
  - `required`: Boolean flag
  - `minLength`/`maxLength`: Optional length constraints
  - `rows`: Optional number of visible rows

### 3. Multiple Choice (Radio)
- **Use case**: Select one option from 2-6 choices (similar to quiz)
- **Properties**:
  - `label`: Field label (required)
  - `description`: Optional help text
  - `choices`: Array of choice strings (2-6 items)
  - `required`: Boolean flag

### 4. Dropdown (Select)
- **Use case**: Select one option from many choices (7+ options)
- **Properties**:
  - `label`: Field label (required)
  - `description`: Optional help text
  - `choices`: Array of choice strings (no upper limit)
  - `required`: Boolean flag
  - `searchable`: Boolean for large lists

### 5. Checkbox (Multiple Select)
- **Use case**: Select multiple options from a list
- **Properties**:
  - `label`: Field label (required)
  - `description`: Optional help text
  - `choices`: Array of choice strings
  - `required`: Boolean flag
  - `minSelections`/`maxSelections`: Optional constraints

### 6. Date Field
- **Use case**: Date selection
- **Properties**:
  - `label`: Field label (required)
  - `description`: Optional help text
  - `required`: Boolean flag
  - `minDate`/`maxDate`: Optional date range constraints
  - `format`: Date format preference (ISO 8601 default)

### 7. Time Field
- **Use case**: Time selection
- **Properties**:
  - `label`: Field label (required)
  - `description`: Optional help text
  - `required`: Boolean flag
  - `format`: 12hr or 24hr format

### 8. Number Field
- **Use case**: Numeric input
- **Properties**:
  - `label`: Field label (required)
  - `description`: Optional help text
  - `required`: Boolean flag
  - `min`/`max`: Optional range constraints
  - `step`: Optional increment step

## TypeScript Interfaces

```typescript
// Field type discriminator
type FieldType = 'text' | 'textarea' | 'radio' | 'dropdown' | 'checkbox' | 'date' | 'time' | 'number';

// Base field interface
interface BaseField {
  id: string;              // Unique identifier for the field
  type: FieldType;
  label: string;
  description?: string;
  required?: boolean;
}

// Specific field interfaces
interface TextField extends BaseField {
  type: 'text';
  placeholder?: string;
  validation?: 'email' | 'url' | 'phone' | string; // string for regex
}

interface TextareaField extends BaseField {
  type: 'textarea';
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  rows?: number;
}

interface RadioField extends BaseField {
  type: 'radio';
  choices: string[];  // 2-6 items
}

interface DropdownField extends BaseField {
  type: 'dropdown';
  choices: string[];
  searchable?: boolean;
}

interface CheckboxField extends BaseField {
  type: 'checkbox';
  choices: string[];
  minSelections?: number;
  maxSelections?: number;
}

interface DateField extends BaseField {
  type: 'date';
  minDate?: string;
  maxDate?: string;
  format?: string;
}

interface TimeField extends BaseField {
  type: 'time';
  format?: '12hr' | '24hr';
}

interface NumberField extends BaseField {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}

// Union type for all fields
type FormField = TextField | TextareaField | RadioField | DropdownField |
                 CheckboxField | DateField | TimeField | NumberField;

// Form data interface
interface FormData {
  title?: string;
  description?: string;
  fields: FormField[];
  userResponses?: Record<string, any>; // Maps field.id to user's answer
}

type FormResult = ToolResult<never, FormData>;
```

## Tool Definition

**Tool Name**: `createForm`

**Description**: Create a structured form to collect information from the user. Supports various field types including text, dates, dropdowns, and multiple choice.

**Parameters**:
- `title` (optional): Form title
- `description` (optional): Overall form description
- `fields` (required): Array of field objects, each with:
  - `id` (required): Unique identifier string (e.g., "email", "birthdate", "country")
    - Must be unique within the form
    - Will be used as the key in the JSON response
    - Should be descriptive and follow camelCase/snake_case conventions
  - `type` (required): Field type enum ('text', 'textarea', 'radio', 'dropdown', 'checkbox', 'date', 'time', 'number')
  - `label` (required): Field label displayed to the user
  - `description` (optional): Help text explaining the field
  - `required` (optional): Boolean indicating if field is required
  - Type-specific properties (choices, min, max, validation, etc.)

## Implementation Files

### 1. Model File: `src/tools/models/form.ts`
- Export TypeScript interfaces
- Define tool definition with comprehensive parameters
- Implement `createForm` execute function
- Validate field configurations
- Export plugin configuration

### 2. View Component: `src/tools/views/form.vue`
- Main canvas component for displaying the full form
- Render different field types with appropriate input controls
- Handle form submission and validation
- Display validation errors
- Emit responses back to the AI via message

### 3. Preview Component: `src/tools/previews/form.vue`
- Sidebar thumbnail preview
- Show form title and field count
- Indicate completion status

### 4. Plugin Registration: `src/tools/index.ts`
- Import and register the form plugin
- Add to plugin map

## User Interaction Flow

1. **AI Creates Form**: AI calls `createForm` with field definitions
2. **Form Display**: Form appears in main canvas with all fields
3. **User Fills Form**: User interacts with various input types
4. **Validation**: Client-side validation for required fields and constraints
5. **Submission**: User clicks submit button
6. **JSON Output**: User responses sent to AI as structured JSON via text message
7. **AI Processing**: AI receives and processes the structured data

## JSON Output Format

When user submits the form, a JSON message is sent. The property names in the `responses` object correspond to the `field.id` values specified when creating the form:

```json
{
  "formSubmission": {
    "formTitle": "User Registration",
    "responses": {
      "name": "John Doe",
      "email": "john@example.com",
      "birthdate": "1990-05-15",
      "country": "United States",
      "interests": ["Technology", "Sports"],
      "newsletterFrequency": "weekly"
    }
  }
}
```

### Example: Creating a Form with Field IDs

When the AI creates the form, it specifies the `id` for each field:

```javascript
// AI calls createForm with:
{
  "title": "User Registration",
  "fields": [
    {
      "id": "name",           // ← This becomes the key in responses
      "type": "text",
      "label": "Full Name",
      "required": true
    },
    {
      "id": "email",          // ← This becomes the key in responses
      "type": "text",
      "label": "Email Address",
      "validation": "email",
      "required": true
    },
    {
      "id": "birthdate",      // ← This becomes the key in responses
      "type": "date",
      "label": "Date of Birth"
    },
    {
      "id": "country",        // ← This becomes the key in responses
      "type": "dropdown",
      "label": "Country",
      "choices": ["United States", "Canada", "United Kingdom", "..."]
    },
    {
      "id": "interests",      // ← This becomes the key in responses
      "type": "checkbox",
      "label": "Interests",
      "choices": ["Technology", "Sports", "Music", "Art"]
    },
    {
      "id": "newsletterFrequency",  // ← This becomes the key in responses
      "type": "radio",
      "label": "Newsletter Frequency",
      "choices": ["daily", "weekly", "monthly", "never"]
    }
  ]
}
```

### Field ID Requirements

- **Must be unique**: Each field must have a unique `id` within the form
- **Auto-generated if omitted**: If the AI doesn't provide an `id`, the system can auto-generate one (e.g., `field_0`, `field_1`)
- **Recommended format**: Use camelCase or snake_case for programmatic access (e.g., `emailAddress` or `email_address`)
- **Descriptive names**: IDs should be meaningful for the AI to understand the response data (e.g., `userAge` not `field_3`)

### Why Field IDs Matter

The `field.id` serves as the key in the response JSON, allowing the AI to:
1. **Parse responses easily**: Know which value corresponds to which field
2. **Process structured data**: Use the responses in follow-up actions
3. **Reference fields**: Ask clarifying questions about specific fields

## Validation Strategy

### Client-Side (Vue Component)
- Required field checks
- Type-specific validation (email format, date ranges, number ranges)
- Min/max length for text fields
- Min/max selections for checkboxes
- Regex pattern matching
- Prevent submission until all validation passes

### Server-Side (Tool Execute Function)
- Validate field definitions
- Ensure required properties exist
- Check choice arrays have minimum items
- Validate min < max for ranges
- Ensure unique field IDs

## In-Place Error Display Mechanism

### Error State Management

Each field maintains its own error state in the Vue component:

```typescript
interface FieldError {
  fieldId: string;
  message: string;
  type: 'required' | 'format' | 'range' | 'pattern' | 'custom';
}

// Component reactive state
const fieldErrors = ref<Map<string, FieldError>>(new Map());
const touched = ref<Set<string>>(new Set()); // Track which fields user has interacted with
```

### Validation Triggers

1. **On Blur (Field Leave)**: Validate when user leaves a field
   - Mark field as "touched"
   - Run validation for that specific field
   - Display error immediately if validation fails

2. **On Input (Real-time)**: For certain validations
   - Character count for text/textarea (show as user types)
   - Number range validation (immediate feedback)
   - Email format (validate after pause in typing)

3. **On Submit**: Validate all fields
   - Validate entire form
   - Mark all fields as touched
   - Scroll to first error
   - Prevent form submission
   - Show summary of errors at top (optional)

### Error Message Generation

Type-specific error messages:

```typescript
function getErrorMessage(field: FormField, value: any): string | null {
  // Required field validation
  if (field.required && isEmpty(value)) {
    return `${field.label} is required`;
  }

  // Type-specific validations
  switch (field.type) {
    case 'text':
      if (field.validation === 'email' && !isValidEmail(value)) {
        return 'Please enter a valid email address';
      }
      if (field.validation === 'url' && !isValidUrl(value)) {
        return 'Please enter a valid URL';
      }
      if (field.validation === 'phone' && !isValidPhone(value)) {
        return 'Please enter a valid phone number';
      }
      if (typeof field.validation === 'string' && !new RegExp(field.validation).test(value)) {
        return `${field.label} format is invalid`;
      }
      break;

    case 'textarea':
      if (field.minLength && value.length < field.minLength) {
        return `Must be at least ${field.minLength} characters (currently ${value.length})`;
      }
      if (field.maxLength && value.length > field.maxLength) {
        return `Must be no more than ${field.maxLength} characters (currently ${value.length})`;
      }
      break;

    case 'number':
      if (field.min !== undefined && value < field.min) {
        return `Must be at least ${field.min}`;
      }
      if (field.max !== undefined && value > field.max) {
        return `Must be no more than ${field.max}`;
      }
      break;

    case 'date':
      if (field.minDate && value < field.minDate) {
        return `Date must be on or after ${formatDate(field.minDate)}`;
      }
      if (field.maxDate && value > field.maxDate) {
        return `Date must be on or before ${formatDate(field.maxDate)}`;
      }
      break;

    case 'checkbox':
      const selectedCount = value?.length || 0;
      if (field.minSelections && selectedCount < field.minSelections) {
        return `Please select at least ${field.minSelections} option${field.minSelections > 1 ? 's' : ''}`;
      }
      if (field.maxSelections && selectedCount > field.maxSelections) {
        return `Please select no more than ${field.maxSelections} option${field.maxSelections > 1 ? 's' : ''}`;
      }
      break;
  }

  return null; // No error
}
```

### Visual Error Display

Each field renders with error state:

```vue
<template>
  <div class="form-field" :class="{ 'has-error': hasError(field.id) }">
    <!-- Field label with required indicator -->
    <label :for="field.id" class="field-label">
      {{ field.label }}
      <span v-if="field.required" class="required-indicator" aria-label="required">*</span>
    </label>

    <!-- Field description -->
    <p v-if="field.description" class="field-description">
      {{ field.description }}
    </p>

    <!-- Input element (varies by type) -->
    <input
      :id="field.id"
      v-model="formData[field.id]"
      :class="{ 'error-border': hasError(field.id) }"
      :aria-invalid="hasError(field.id)"
      :aria-describedby="hasError(field.id) ? `${field.id}-error` : undefined"
      @blur="validateField(field.id)"
      @input="onFieldInput(field.id)"
    />

    <!-- Error message display -->
    <div
      v-if="hasError(field.id) && touched.has(field.id)"
      :id="`${field.id}-error`"
      class="error-message"
      role="alert"
    >
      <svg class="error-icon" aria-hidden="true"><!-- Error icon --></svg>
      {{ fieldErrors.get(field.id)?.message }}
    </div>

    <!-- Character count for text/textarea (not an error, just helpful) -->
    <div
      v-if="showCharCount(field)"
      class="char-count"
      :class="{ 'char-count-warning': isNearLimit(field) }"
    >
      {{ formData[field.id]?.length || 0 }}{{ field.maxLength ? ` / ${field.maxLength}` : '' }}
    </div>
  </div>
</template>
```

### CSS Styling for Error States

```css
/* Error border for inputs */
.error-border {
  border-color: #ef4444; /* red-500 */
  outline-color: #ef4444;
}

.error-border:focus {
  border-color: #dc2626; /* red-600 */
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

/* Error message */
.error-message {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.375rem;
  font-size: 0.875rem;
  color: #dc2626; /* red-600 */
}

.error-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

/* Field container with error */
.form-field.has-error .field-label {
  color: #dc2626; /* red-600 */
}

/* Required indicator */
.required-indicator {
  color: #ef4444; /* red-500 */
  font-weight: bold;
  margin-left: 0.25rem;
}

/* Character count warning (approaching limit) */
.char-count-warning {
  color: #f59e0b; /* amber-500 */
  font-weight: 600;
}
```

### Error Summary (Optional)

Display a summary at the top of the form when submission is attempted with errors:

```vue
<div v-if="showErrorSummary && fieldErrors.size > 0" class="error-summary" role="alert">
  <h3 class="error-summary-title">Please fix the following errors:</h3>
  <ul class="error-summary-list">
    <li v-for="[fieldId, error] in fieldErrors" :key="fieldId">
      <a :href="`#${fieldId}`" @click.prevent="focusField(fieldId)">
        {{ error.message }}
      </a>
    </li>
  </ul>
</div>
```

### Accessibility Features

1. **ARIA attributes**:
   - `aria-invalid="true"` on fields with errors
   - `aria-describedby` linking to error message
   - `role="alert"` on error messages for screen reader announcement

2. **Focus management**:
   - Auto-focus first error field on submit
   - Clickable error summary that focuses fields

3. **Visual indicators**:
   - Red border on invalid fields
   - Error icon + message below field
   - Required asterisk on labels
   - Color contrast meeting WCAG AA standards

4. **Keyboard navigation**:
   - Tab through all fields and submit button
   - Error messages announced when field receives focus

### Error State Behavior

1. **Initial Load**: No errors shown (all fields untouched)
2. **User Interaction**: Errors appear on blur for touched fields
3. **Form Submission Attempt**: All fields marked touched, all errors shown
4. **Error Correction**: Error disappears when field becomes valid
5. **Real-time Feedback**: Character counts, range indicators update as user types

This approach provides immediate, contextual feedback without overwhelming the user on initial page load.

## Form State Persistence and Restoration

### Overview

When users navigate away from the form and return later, all their entered values and selections must be preserved. This is achieved using the `viewState` property of `ToolResult`.

### ViewState Structure

```typescript
interface FormViewState {
  userResponses: Record<string, any>;  // Maps field.id to user's input
  touched: string[];                    // Array of field IDs that have been touched
  submitted?: boolean;                  // Whether the form has been submitted
}
```

### Implementation in form.vue

The view component manages state persistence through Vue watchers:

```typescript
// Component reactive state
const formData = ref<Record<string, any>>({});  // Current form values
const touched = ref<Set<string>>(new Set());    // Touched fields
const submitted = ref<boolean>(false);           // Submission status

// Initialize from selectedResult on mount or when result changes
watch(
  () => props.selectedResult,
  (newResult) => {
    if (newResult?.toolName === "createForm" && newResult.jsonData) {
      const data = newResult.jsonData as FormData;

      // Initialize formData for all fields
      formData.value = {};
      data.fields.forEach(field => {
        formData.value[field.id] = getDefaultValue(field);
      });

      // Restore from viewState if available
      if (newResult.viewState) {
        const viewState = newResult.viewState as FormViewState;

        // Restore user responses
        if (viewState.userResponses) {
          Object.assign(formData.value, viewState.userResponses);
        }

        // Restore touched state
        if (viewState.touched) {
          touched.value = new Set(viewState.touched);
        }

        // Restore submitted state
        if (viewState.submitted) {
          submitted.value = viewState.submitted;
        }
      }
    }
  },
  { immediate: true }
);

// Auto-save formData changes to viewState
watch(
  formData,
  (newFormData) => {
    if (props.selectedResult) {
      const updatedResult: ToolResult = {
        ...props.selectedResult,
        viewState: {
          userResponses: { ...newFormData },
          touched: Array.from(touched.value),
          submitted: submitted.value,
        },
      };
      emit("updateResult", updatedResult);
    }
  },
  { deep: true }
);

// Also save touched state changes
watch(
  touched,
  () => {
    if (props.selectedResult) {
      const updatedResult: ToolResult = {
        ...props.selectedResult,
        viewState: {
          userResponses: { ...formData.value },
          touched: Array.from(touched.value),
          submitted: submitted.value,
        },
      };
      emit("updateResult", updatedResult);
    }
  },
  { deep: true }
);
```

### Default Value Helper

Different field types require different default values:

```typescript
function getDefaultValue(field: FormField): any {
  switch (field.type) {
    case 'text':
    case 'textarea':
      return '';

    case 'number':
      return field.min !== undefined ? field.min : 0;

    case 'date':
      return '';  // Empty string for unselected date

    case 'time':
      return '';  // Empty string for unselected time

    case 'radio':
    case 'dropdown':
      return null;  // No selection

    case 'checkbox':
      return [];  // Empty array for no selections

    default:
      return null;
  }
}
```

### State Restoration Flow

1. **User Creates Form**: AI calls `createForm`, form appears with empty fields
2. **User Starts Filling**:
   - Each input triggers `formData` watcher
   - `viewState` updated with current values
   - Changes persisted to `ToolResult`
3. **User Navigates Away**: Switches to another tool result
4. **User Returns to Form**:
   - `selectedResult` watcher fires
   - Checks for `viewState.userResponses`
   - Restores all field values from viewState
   - Restores touched fields (to show errors if applicable)
   - User sees form exactly as they left it

### Handling Different Field Types

Each field type requires specific restoration logic:

#### Text/Textarea Fields
```typescript
// Simple string restoration
<input v-model="formData[field.id]" />
<textarea v-model="formData[field.id]" />
```

#### Number Fields
```typescript
// Ensure numeric type
<input
  type="number"
  v-model.number="formData[field.id]"
/>
```

#### Date/Time Fields
```typescript
// ISO format strings
<input
  type="date"
  v-model="formData[field.id]"
/>
<input
  type="time"
  v-model="formData[field.id]"
/>
```

#### Radio Fields
```typescript
// Restore selected index
<input
  type="radio"
  :name="`field-${field.id}`"
  :value="index"
  v-model="formData[field.id]"
/>
```

#### Dropdown Fields
```typescript
// Restore selected value
<select v-model="formData[field.id]">
  <option :value="null" disabled>Select...</option>
  <option
    v-for="(choice, index) in field.choices"
    :key="index"
    :value="index"
  >
    {{ choice }}
  </option>
</select>
```

#### Checkbox Fields
```typescript
// Restore array of selected indices
<input
  type="checkbox"
  :value="index"
  v-model="formData[field.id]"
/>
// formData[field.id] = [0, 2, 3] (selected indices)
```

### Preserving Error State

Error state should also persist across navigation:

```typescript
// After restoring formData, re-validate if fields were touched
watch(
  () => props.selectedResult,
  (newResult) => {
    if (newResult?.viewState?.touched) {
      // Re-validate all touched fields to show errors
      newResult.viewState.touched.forEach((fieldId: string) => {
        validateField(fieldId);
      });
    }
  },
  { immediate: true }
);
```

### Preventing Data Loss

To ensure no data loss:

1. **Debounced Updates**: Avoid excessive viewState updates
   ```typescript
   import { debounce } from 'lodash-es';

   const saveViewState = debounce(() => {
     // Save to viewState
   }, 300);
   ```

2. **Deep Watching**: Use `{ deep: true }` for nested objects/arrays

3. **Immediate Validation**: Don't wait for blur on restored fields

### Testing State Persistence

Key scenarios to test:

1. Fill form → Navigate away → Return → Verify all values restored
2. Fill half the form → Navigate away → Return → Continue filling
3. Trigger validation errors → Navigate away → Return → Errors still shown
4. Select checkboxes → Navigate away → Return → Selections preserved
5. Submit form → Navigate away → Return → Submit state preserved

### ViewState Data Flow

```
User Input
    ↓
formData updated (v-model)
    ↓
formData watcher fires
    ↓
Create updated ToolResult with new viewState
    ↓
emit("updateResult", updatedResult)
    ↓
Parent component updates toolResults array
    ↓
Data persisted in memory
    ↓
User navigates away (selectedResult changes)
    ↓
User returns (selectedResult changes back)
    ↓
selectedResult watcher fires
    ↓
Extract viewState.userResponses
    ↓
Restore formData values
    ↓
Re-render form with preserved values
```

This approach ensures seamless state preservation without requiring external storage or backend persistence.

## UI/UX Considerations

1. **Accessibility**: Proper label associations, ARIA attributes, keyboard navigation
2. **Responsive Design**: Mobile-friendly form layout
3. **Visual Feedback**: Clear indication of required fields, validation errors, focus states
4. **Progressive Disclosure**: Field descriptions shown on hover/focus
5. **Smart Defaults**: Reasonable defaults for optional properties
6. **Loading States**: Show "Preparing form..." during creation

## Integration with Existing Architecture

1. **Composables**: Leverage existing `useToolResults` for result management
2. **Plugin System**: Follow established plugin interface pattern
3. **Styling**: Use consistent Vue/Tailwind CSS patterns from other components
4. **Instructions**: Return appropriate instructions for AI to wait for submission
5. **Message Format**: Use same text message emission pattern as quiz plugin

## Example Use Cases

1. **User Registration**: Name, email, password, birthdate, country dropdown
2. **Feedback Survey**: Rating scales, multiple choice, long-form textarea
3. **Event RSVP**: Date picker, time picker, number of guests, dietary restrictions
4. **Order Form**: Product dropdown, quantity number field, delivery date, special instructions
5. **Application Form**: Mix of all field types for comprehensive data collection

## Testing Considerations

1. Test each field type independently
2. Test validation rules (required, min/max, patterns)
3. Test form submission with various combinations
4. Test JSON output format
5. Test error handling for invalid configurations
6. Test UI responsiveness on different screen sizes

## Future Enhancements (Out of Scope)

- File upload fields
- Rich text editor fields
- Conditional field visibility (show field X if field Y = Z)
- Multi-step/paginated forms
- Form data persistence/auto-save
- Custom validation functions
- Field groups/sections

## Success Criteria

1. ✓ Support all 8 planned field types
2. ✓ Generate valid, structured JSON output
3. ✓ Provide clear field descriptions and labels
4. ✓ Implement comprehensive validation
5. ✓ Integrate seamlessly with voice chat workflow
6. ✓ Match or exceed quiz plugin UX quality
7. ✓ Follow existing codebase patterns and conventions
