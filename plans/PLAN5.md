# PLAN5: Refactor Image Generation to Use Shared API

## Problem Statement

Currently, `markdown.ts` and `mulmocast.ts` hardcode calls to `/api/generate-image` (Gemini endpoint), bypassing the user's image generation backend preference. The `generateImage.ts` plugin has logic to respect the `imageGenerationBackend` configuration and choose between Gemini and ComfyUI, but this logic is not reusable.

## Goal

Export a shared API function from `generateImage.ts` that encapsulates the backend selection and API calling logic, then use this shared function in both `markdown.ts` and `mulmocast.ts` to ensure consistent backend usage across all plugins.

## Current State Analysis

### generateImage.ts (lines 29-113)
- Contains `generateImageCommon()` function with backend selection logic
- Checks `context.getPluginConfig?.("imageGenerationBackend")` with fallback chain
- Selects endpoint based on backend: `/api/generate-image/comfy` or `/api/generate-image`
- Handles different response formats from ComfyUI (array) vs Gemini (single image)

### markdown.ts (line 60)
- Hardcodes `/api/generate-image` endpoint
- Passes prompt and images array directly
- Only handles Gemini response format

### mulmocast.ts (line 143)
- Hardcodes `/api/generate-image` endpoint
- Passes prompt and imageRefs array
- Only handles Gemini response format

## Implementation Plan

### Step 1: Export Shared API from generateImage.ts

**Create new exported function**: `generateImageWithBackend()`

```typescript
export async function generateImageWithBackend(
  prompt: string,
  images: string[],
  context?: ToolContext
): Promise<{ success: boolean; imageData?: string; message?: string }>
```

This function will:
- Accept prompt, images array, and optional context
- Determine backend using the same logic as `generateImageCommon()`
- Select appropriate endpoint
- Make fetch request
- Handle both ComfyUI and Gemini response formats
- Return normalized response with `{ success, imageData, message }`

**Refactor `generateImageCommon()`**:
- Update to use the new `generateImageWithBackend()` function internally
- Keep the same return type `Promise<ToolResult<ImageToolData>>`
- Maintain backward compatibility

### Step 2: Update markdown.ts

**Replace direct fetch call** (lines 60-76):
- Import `generateImageWithBackend` from `./generateImage`
- Replace fetch logic with call to `generateImageWithBackend(prompt, [blankImageBase64], context)`
- Handle the normalized response format

### Step 3: Update mulmocast.ts

**Replace direct fetch call** (lines 143-165):
- Import `generateImageWithBackend` from `./generateImage`
- Replace fetch logic with call to `generateImageWithBackend(prompt, imageRefs, context)`
- Handle the normalized response format

### Step 4: Testing

**Verify functionality**:
1. Test `generateImage` plugin with both Gemini and ComfyUI backends
2. Test `markdown` plugin with image placeholders using both backends
3. Test `mulmocast` plugin with presentation generation using both backends
4. Verify that changing `imageGenerationBackend` config affects all three plugins

## Benefits

1. **Consistency**: All plugins respect user's backend preference
2. **Maintainability**: Backend selection logic exists in one place
3. **Extensibility**: Adding new backends only requires changes to `generateImage.ts`
4. **Type Safety**: Shared function provides consistent interface and types

## Edge Cases to Handle

1. **Context unavailable**: If `context` is undefined, default to "gemini" backend
2. **Network failures**: Preserve existing error handling in markdown/mulmocast
3. **Response format variations**: Normalize both ComfyUI and Gemini responses to consistent format
4. **Base64 prefixes**: Handle images with or without `data:image/png;base64,` prefix

## Files to Modify

1. `src/tools/models/generateImage.ts` - Export new shared function
2. `src/tools/models/markdown.ts` - Use shared function
3. `src/tools/models/mulmocast.ts` - Use shared function

## Success Criteria

- All three plugins (generateImage, markdown, mulmocast) use the same backend selection logic
- User can switch between Gemini and ComfyUI and all plugins respect the choice
- No breaking changes to existing functionality
- Error handling preserved in all plugins
