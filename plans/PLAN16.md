# PLAN16: Add xAI Grok as Text LLM Provider

## Goal

Add xAI's Grok models as a selectable text LLM provider in the UI, allowing users to use Grok alongside existing providers (OpenAI, Anthropic, Google, Ollama).

## Current Architecture

### Text LLM System Overview

The application uses a **unified LLM abstraction layer** (`server/llm/`) that supports multiple providers through a common interface:

**Core Components:**
- `server/llm/types.ts` - Defines `TextLLMProviderId` type and common interfaces
- `server/llm/textService.ts` - Routes requests to provider implementations
- `server/llm/providers/` - Individual provider implementations
- `server/routes/textLLM.ts` - Express routes for text generation API

**Provider Pattern:**
Each provider implements:
```typescript
async function generateWithProvider(
  params: ProviderGenerateParams
): Promise<TextGenerationResult>
```

**Client Integration:**
- `src/App.vue` - Fetches available providers from `/api/text/providers` on mount
- `src/components/Sidebar.vue` - Displays model selector dropdown
- User selection stored in `userPreferences.textModelId` with format `"provider:model"`

### Current Providers

1. **OpenAI** (`server/llm/providers/openai.ts`)
   - API: `https://api.openai.com/v1/chat/completions`
   - Env: `OPENAI_API_KEY`
   - Default: `gpt-4o-mini`

2. **Anthropic** (`server/llm/providers/anthropic.ts`)
   - SDK: `@anthropic-ai/sdk`
   - Env: `ANTHROPIC_API_KEY`
   - Default: `claude-sonnet-4-5`

3. **Google Gemini** (`server/llm/providers/google.ts`)
   - SDK: `@google/genai`
   - Env: `GEMINI_API_KEY`
   - Default: `gemini-2.5-flash`

4. **Ollama** (`server/llm/providers/ollama.ts`)
   - API: `http://127.0.0.1:11434/api/chat` (configurable via `OLLAMA_BASE_URL`)
   - No credentials required (local)
   - Default: `gpt-oss:20b`

## xAI API Overview

### API Endpoint
```
https://api.x.ai/v1/chat/completions
```

### Authentication
```
Authorization: Bearer $XAI_API_KEY
```

### Compatible Models
- `grok-2-1212` - Latest Grok 2 model (Dec 2024)
- `grok-2-vision-1212` - Grok 2 with vision (Dec 2024)
- `grok-beta` - Beta preview of next generation
- `grok-vision-beta` - Beta with vision capabilities

### API Format
The xAI API uses an **OpenAI-compatible format**, making integration straightforward:

**Request:**
```json
{
  "model": "grok-beta",
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1.0,
  "tools": [...]  // Optional function calling
}
```

**Response:**
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help?",
      "tool_calls": [...]  // If function calling used
    }
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

## Implementation Plan

### Phase 1: Backend Integration

#### 1.1 Update Type Definitions

**File:** `server/llm/types.ts:1`

```typescript
// Change from:
export type TextLLMProviderId = "openai" | "anthropic" | "google" | "ollama";

// To:
export type TextLLMProviderId = "openai" | "anthropic" | "google" | "ollama" | "grok";
```

#### 1.2 Create xAI Provider Implementation

**File:** `server/llm/providers/grok.ts` (NEW)

```typescript
import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
} from "../types";

const GROK_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

interface GrokToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface GrokChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string;
      tool_calls?: GrokToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export async function generateWithGrok(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new TextGenerationError(
      "XAI_API_KEY environment variable not set",
      500,
    );
  }

  const requestBody: Record<string, unknown> = {
    model: params.model,
    messages: params.messages.map((message) => {
      const baseMessage: Record<string, unknown> = {
        role: message.role,
        content: message.content,
      };

      // Include tool_call_id for tool messages
      if (message.role === "tool" && message.tool_call_id) {
        baseMessage.tool_call_id = message.tool_call_id;
      }

      // Include tool_calls for assistant messages
      if (message.role === "assistant" && message.tool_calls) {
        baseMessage.tool_calls = message.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        }));
      }

      return baseMessage;
    }),
  };

  if (params.maxTokens !== undefined) {
    requestBody.max_tokens = params.maxTokens;
  }
  if (params.temperature !== undefined) {
    requestBody.temperature = params.temperature;
  }
  if (params.topP !== undefined) {
    requestBody.top_p = params.topP;
  }
  if (params.tools !== undefined && params.tools.length > 0) {
    // Convert to OpenAI-compatible format (which xAI supports)
    requestBody.tools = params.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
    // Enable parallel tool calling (if xAI supports it)
    requestBody.parallel_tool_calls = true;
  }

  const response = await fetch(GROK_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TextGenerationError(
      `xAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
    );
  }

  const data = (await response.json()) as GrokChatCompletionResponse;
  const message = data.choices?.[0]?.message;
  const text = message?.content ?? "";
  const toolCalls = message?.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  return {
    provider: "grok",
    model: params.model,
    text,
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    rawResponse: data,
  };
}
```

**Notes:**
- Implementation follows OpenAI provider pattern (server/llm/providers/openai.ts)
- xAI API is OpenAI-compatible, so same message format works
- Uses `XAI_API_KEY` environment variable
- Supports tool/function calling

#### 1.3 Update Text Service

**File:** `server/llm/textService.ts`

**Changes needed:**

1. Import the new provider (line 1-4):
```typescript
import { generateWithGrok } from "./providers/grok";
```

2. Add default model (line 15-20):
```typescript
const DEFAULT_MODELS: Record<TextLLMProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  ollama: "gpt-oss:20b",
  grok: "grok-2-1212",  // ADD THIS
};
```

3. Add model suggestions (line 22-52):
```typescript
const PROVIDER_MODEL_SUGGESTIONS: Partial<Record<TextLLMProviderId, string[]>> = {
  openai: [...],
  anthropic: [...],
  google: [...],
  ollama: [...],
  grok: [  // ADD THIS
    "grok-2-1212",
    "grok-2-vision-1212",
    "grok-beta",
    "grok-vision-beta",
  ],
};
```

4. Add to provider switch (line 155-171):
```typescript
switch (request.provider) {
  case "openai":
    return generateWithOpenAI(params);
  case "anthropic":
    return generateWithAnthropic(params);
  case "google":
    return generateWithGoogle(params);
  case "ollama":
    return generateWithOllama(params);
  case "grok":  // ADD THIS
    return generateWithGrok(params);
  default:
    // ...
}
```

5. Add to availability check (line 175-180):
```typescript
export function getProviderAvailability(): ProviderAvailability[] {
  const providers: TextLLMProviderId[] = [
    "openai",
    "anthropic",
    "google",
    "ollama",
    "grok",  // ADD THIS
  ];

  return providers.map((provider) => {
    const base: ProviderAvailability = {
      provider,
      hasCredentials:
        provider === "openai"
          ? Boolean(process.env.OPENAI_API_KEY)
          : provider === "anthropic"
            ? Boolean(process.env.ANTHROPIC_API_KEY)
            : provider === "google"
              ? Boolean(process.env.GEMINI_API_KEY)
              : provider === "grok"  // ADD THIS
                ? Boolean(process.env.XAI_API_KEY)
                : true,
    };
    // ...
  });
}
```

#### 1.4 Update Route Validation

**File:** `server/routes/textLLM.ts:21-28`

```typescript
function isProviderId(value: unknown): value is TextLLMProviderId {
  return (
    value === "openai" ||
    value === "anthropic" ||
    value === "google" ||
    value === "ollama" ||
    value === "grok"  // ADD THIS
  );
}
```

### Phase 2: Frontend Integration

#### 2.1 Update Provider Labels

**File:** `src/App.vue:232-237`

```typescript
const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  ollama: "Ollama",
  grok: "xAI Grok",  // ADD THIS
};
```

#### 2.2 UI Testing

No code changes needed! The UI automatically:
1. Fetches providers from `/api/text/providers` on mount (App.vue:335-398)
2. Populates dropdown with all available models (Sidebar.vue:279-293)
3. Marks models without credentials as disabled
4. Shows provider name and model in status line

### Phase 3: Configuration

#### 3.1 Environment Variables

**File:** `.env` (or deployment environment)

Add:
```bash
XAI_API_KEY=xai-your-api-key-here
```

To obtain an API key:
1. Visit https://console.x.ai/
2. Create an account or sign in
3. Navigate to API Keys section
4. Generate a new API key

#### 3.2 Documentation Updates

**File:** `CLAUDE.md` (update Server Architecture section)

Add xAI to the list of integrated AI services:
```markdown
### Key Integration Points

The application integrates multiple AI services and APIs:
1. **OpenAI Realtime API**: Voice chat with WebRTC and function calling
2. **Google Gemini**: Image generation and editing
3. **Exa API**: AI-powered web search
4. **Google Maps API**: Location services and mapping
5. **Twitter API**: Tweet embedding (server-side)
6. **xAI Grok**: Text generation with function calling  // ADD THIS
```

## Testing Plan

### 3.1 Unit Tests

Test the new provider implementation:

```typescript
// Test with valid API key
describe("generateWithGrok", () => {
  it("should generate text successfully", async () => {
    const result = await generateWithGrok({
      model: "grok-2-1212",
      messages: [{ role: "user", content: "Hello" }],
      conversationMessages: [{ role: "user", content: "Hello" }],
    });

    expect(result.provider).toBe("grok");
    expect(result.text).toBeTruthy();
  });

  it("should handle tool calls", async () => {
    // Test with tools parameter
  });

  it("should throw error without API key", async () => {
    delete process.env.XAI_API_KEY;
    await expect(generateWithGrok(params)).rejects.toThrow();
  });
});
```

### 3.2 Integration Tests

1. **Provider Availability:**
   - Start server without `XAI_API_KEY`
   - Visit `/api/text/providers`
   - Verify grok provider appears with `hasCredentials: false`
   - Add `XAI_API_KEY` to environment
   - Restart server
   - Verify grok provider shows `hasCredentials: true`

2. **UI Selection:**
   - Open application
   - Navigate to text mode (not voice)
   - Check model dropdown in sidebar
   - Verify "xAI Grok" models appear
   - Select a Grok model
   - Verify selection persists in localStorage

3. **Text Generation:**
   - Select "grok-2-1212" model
   - Send a test message: "What is 2+2?"
   - Verify response appears in chat
   - Check status line shows "Text / xAI Grok grok-2-1212"

4. **Tool Calling:**
   - Enable a plugin (e.g., generateImage)
   - Ask Grok to use the tool: "Generate an image of a sunset"
   - Verify tool call is made
   - Verify tool result is processed
   - Verify Grok responds with follow-up

5. **Error Handling:**
   - Remove API key
   - Attempt to send message
   - Verify error message displays properly
   - Verify UI doesn't crash

### 3.3 Manual Testing Checklist

- [ ] Server starts successfully with new provider
- [ ] `/api/text/providers` includes grok in response
- [ ] Grok models appear in UI dropdown
- [ ] Models without API key are marked "credentials required" and disabled
- [ ] Can select a Grok model from dropdown
- [ ] Status line updates to show selected Grok model
- [ ] Can send messages and receive responses
- [ ] Tool/function calling works with plugins
- [ ] Token usage is reported correctly
- [ ] Error messages are user-friendly
- [ ] Can switch between Grok and other providers
- [ ] Selection persists across page reloads

## Implementation Checklist

### Backend
- [ ] Update `TextLLMProviderId` type in `server/llm/types.ts`
- [ ] Create `server/llm/providers/grok.ts`
- [ ] Import provider in `server/llm/textService.ts`
- [ ] Add default model in `textService.ts`
- [ ] Add model suggestions in `textService.ts`
- [ ] Add to provider switch in `textService.ts`
- [ ] Add to availability check in `textService.ts`
- [ ] Update `isProviderId()` validation in `server/routes/textLLM.ts`

### Frontend
- [ ] Add "grok" to `PROVIDER_LABELS` in `src/App.vue`

### Configuration
- [ ] Add `XAI_API_KEY` to environment variables
- [ ] Update `.env.example` with XAI_API_KEY
- [ ] Document how to obtain xAI API key

### Documentation
- [ ] Update `CLAUDE.md` with xAI integration
- [ ] Add xAI to README if applicable

### Testing
- [ ] Test provider availability endpoint
- [ ] Test UI model selection
- [ ] Test text generation
- [ ] Test tool calling
- [ ] Test error handling
- [ ] Manual testing checklist complete

## API Reference

**Official Documentation:**
- xAI Platform: https://console.x.ai/
- API Documentation: https://docs.x.ai/api
- OpenAI Compatibility: https://docs.x.ai/docs/guides/openai-compatibility

**Rate Limits:**
- Check xAI documentation for current rate limits
- Implement rate limiting if necessary

**Pricing:**
- Refer to https://x.ai/api for current pricing
- Consider adding cost tracking if needed

## Risk Assessment

### Low Risk
- xAI API is OpenAI-compatible, minimizing integration complexity
- Implementation follows established provider pattern
- No breaking changes to existing functionality

### Potential Issues
1. **API Compatibility Changes:** xAI might diverge from OpenAI format in future
   - **Mitigation:** Monitor xAI changelog, maintain provider abstraction

2. **Rate Limiting:** xAI may have different rate limits than other providers
   - **Mitigation:** Add rate limit handling if needed, display errors clearly

3. **Model Availability:** Model names might change or be deprecated
   - **Mitigation:** Keep model list updated, handle unknown models gracefully

## Success Criteria

- ✅ xAI Grok appears as selectable provider in UI
- ✅ Can generate text responses using Grok models
- ✅ Function/tool calling works with Grok
- ✅ Credentials validation works (shows disabled without API key)
- ✅ Status line correctly displays Grok model name
- ✅ No breaking changes to existing providers
- ✅ Error handling is robust and user-friendly

## Future Enhancements

1. **Vision Support:** Add support for Grok vision models with image inputs
2. **Streaming:** Implement streaming responses for better UX
3. **Model Metadata:** Display model capabilities, context length, pricing
4. **Usage Analytics:** Track token usage per provider for cost monitoring
5. **Provider Preferences:** Allow setting default provider per conversation type
