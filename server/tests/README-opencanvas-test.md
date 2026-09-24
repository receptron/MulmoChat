# OpenCanvas Tool Call Tests

## Overview

These test programs verify that when a user sends the message "open canvas", different LLM providers correctly interpret the intent and generate a tool call to the `openCanvas` function.

The tests **do not execute** the actual `openCanvas` API - they only verify that the LLM generates the appropriate tool call structure.

## What It Tests

1. **User Input**: Sends the message "open canvas" to the LLM
2. **Tool Definition**: Provides the `openCanvas` tool definition to the LLM
3. **Verification**: Checks that the LLM response includes a tool call to `openCanvas`

## Available Test Files

- `test-opencanvas.ts` - OpenAI (gpt-4o-mini, gpt-4o, etc.)
- `test-opencanvas-anthropic.ts` - Anthropic Claude (claude-3-5-sonnet, etc.)
- `test-opencanvas-google.ts` - Google Gemini (gemini-3.6-flash, etc.)
- `test-opencanvas-ollama.ts` - Ollama (llama3.1, qwen2.5, etc.)

## Prerequisites

- Node.js installed
- API key(s) for the provider(s) you want to test
- Server running on `http://localhost:3001` (or set `TEST_SERVER_URL`)

## Setup

### OpenAI

1. Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=sk-...
OPENAI_TEST_MODEL=gpt-4o-mini  # optional
```

### Anthropic Claude

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_TEST_MODEL=claude-3-5-sonnet-latest  # optional
```

### Google Gemini

```bash
GEMINI_API_KEY=...
GEMINI_TEST_MODEL=gemini-3.6-flash  # optional
```

### Ollama

No API key needed (local). Make sure Ollama is running:

```bash
ollama serve  # Start Ollama server
ollama pull llama3.1  # Pull a model with function calling support
```

```bash
OLLAMA_TEST_MODEL=llama3.1  # optional
OLLAMA_BASE_URL=http://127.0.0.1:11434  # optional
```

### Common Settings

```bash
TEST_SERVER_URL=http://localhost:3001  # optional
```

## Running the Tests

### Direct execution with tsx

```bash
# OpenAI
npx tsx server/tests/test-opencanvas.ts

# Anthropic
npx tsx server/tests/test-opencanvas-anthropic.ts

# Google Gemini
npx tsx server/tests/test-opencanvas-google.ts

# Ollama
npx tsx server/tests/test-opencanvas-ollama.ts
```

### Add to package.json scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "test:opencanvas": "tsx server/tests/test-opencanvas.ts",
    "test:opencanvas:anthropic": "tsx server/tests/test-opencanvas-anthropic.ts",
    "test:opencanvas:google": "tsx server/tests/test-opencanvas-google.ts",
    "test:opencanvas:ollama": "tsx server/tests/test-opencanvas-ollama.ts"
  }
}
```

Then run:

```bash
npm run test:opencanvas
npm run test:opencanvas:anthropic
npm run test:opencanvas:google
npm run test:opencanvas:ollama
```

## Expected Output

### Success (OpenAI example)

```
=== OpenCanvas Tool Call Test ===

Model: gpt-4o-mini

Step 1: Sending user message "open canvas"...

Model response text: ""

✓ Tool calls received: 1

✓ Verified: LLM called openCanvas tool
  Tool Call ID: call_abc123
  Arguments: {}

Token usage: { promptTokens: 49, completionTokens: 10, totalTokens: 59 }

✅ TEST PASSED: LLM correctly generated openCanvas tool call!
```

### Failure (if LLM doesn't call the tool)

```
❌ TEST FAILED: Expected openCanvas tool call but got none!
```

### Warning (Ollama - model doesn't support function calling)

```
⚠️  WARNING: Expected openCanvas tool call but got none!
This model may not support function calling, or it chose to respond directly.

⚠ Test completed, but function calling was not demonstrated.
Try a different model that supports function calling (e.g., llama3.1, qwen2.5).
```

## How It Works

1. **Tool Definition**: The test provides the exact tool definition used in the app:
   ```typescript
   {
     type: "function",
     name: "openCanvas",
     description: "Open a drawing canvas for the user to create drawings, sketches, or diagrams."
   }
   ```

2. **API Call**: Sends a POST request to `/api/text/generate` with:
   - User message: "open canvas"
   - Available tools: `[openCanvasTool]`

3. **Response Parsing**: Checks the response for:
   - `success: true`
   - `result.toolCalls` array containing an entry with `name: "openCanvas"`

4. **Verification**: Confirms the LLM understood the natural language intent and mapped it to the correct function call

## Key Points

- This is a **behavioral test** of LLM tool calling capabilities
- It tests the **intent mapping**: natural language → function call
- The test is **isolated** - it doesn't depend on the full Vue.js app
- It uses the same API endpoint (`/api/text/generate`) that the text-rest transport uses
- The `openCanvas` tool requires no parameters, so the test expects empty or no arguments

## Important Fix Applied

**Google Gemini API Structure**: The Google provider previously had tools/toolConfig at the wrong level. They must be inside a `config` object:

```typescript
// Correct structure for Google GenAI SDK
{
  model: "gemini-3.6-flash",
  contents: [...],
  config: {           // Tools go inside config
    tools: [...],
    toolConfig: {...}
  }
}
```

This fix resolved issues where Gemini was not calling tools even with `mode: "ANY"` configured.

## Provider-Specific Notes

### OpenAI
- ✅ Excellent function calling support
- All modern models (gpt-4o, gpt-4o-mini, gpt-4-turbo) work well
- Typically returns empty text with only tool calls

### Anthropic Claude
- ✅ Excellent function calling support
- Claude 3.5 Sonnet and newer models work well
- May include brief text along with tool calls

### Google Gemini
- ✅ Excellent function calling support
- Gemini 2.5 Flash and Pro models work well
- Requires proper API request structure (tools/toolConfig in `config` object)
- With correct configuration, reliably calls tools

### Ollama
- ⚠️ Function calling support varies by model
- Works well: llama3.1, qwen2.5, mistral-nemo
- May not work: older models, smaller models
- No API key needed (runs locally)

## Troubleshooting

### Server not running
```
Request failed: ECONNREFUSED
```
**Solution**: Start the development server with `npm run dev:server`

### Missing API key (OpenAI)
```
OPENAI_API_KEY is required to run this test.
```
**Solution**: Add the appropriate API key to your `.env` file

### Missing API key (Anthropic)
```
ANTHROPIC_API_KEY is required to run this test.
```
**Solution**: Add `ANTHROPIC_API_KEY=sk-ant-...` to your `.env` file

### Missing API key (Google)
```
GEMINI_API_KEY is required to run this test.
```
**Solution**: Add `GEMINI_API_KEY=...` to your `.env` file

### Ollama not running
```
Request failed: ECONNREFUSED
```
**Solution**: Start Ollama with `ollama serve`

### LLM doesn't call the tool

If the LLM returns text instead of a tool call:
- **Model doesn't support function calling**: Try a newer/larger model
- **OpenAI**: Use gpt-4o or gpt-4o-mini
- **Anthropic**: Use claude-3-5-sonnet-latest
- **Google**: Use gemini-3.6-flash or gemini-3.1-pro-preview
- **Ollama**: Use llama3.1, qwen2.5, or other function-calling capable models

## Related Files

### Test Files
- `server/tests/test-opencanvas.ts` - OpenAI test
- `server/tests/test-opencanvas-anthropic.ts` - Anthropic test
- `server/tests/test-opencanvas-google.ts` - Google test
- `server/tests/test-opencanvas-ollama.ts` - Ollama test

### Source Files
- `src/tools/models/canvas.ts` - Canvas tool definition
- `src/tools/index.ts` - Tool system and plugin registry
- `src/composables/useTextSession.ts` - Text session transport implementation
- `server/llm/textService.ts` - Text generation service backend
