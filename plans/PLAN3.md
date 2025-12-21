# PLAN3: Remove Queue System, Append Messages Immediately

## Overview
Remove the queuing system for instructions and tool outputs in the text session API. Instead, append these directly to the session's message history so the LLM can reference them in future turns.

**Scope**: Text session API only (server-side). No changes to voice/realtime API.

## Current Architecture

### Queuing System (To Be Removed)
- `queuedInstructions: string[]` - Temporary storage for instructions
- `queuedToolOutputs: QueuedToolOutputPayload[]` - Temporary storage for tool outputs
- Queue operations:
  - `queueSessionInstructions()` - Adds instructions to queue
  - `queueSessionToolOutputs()` - Adds tool outputs to queue
  - `clearSessionQueues()` - Clears both queues after use

### Current Flow
1. Client calls `/text/session/:sessionId/tool-output` → outputs queued
2. Client calls `/text/session/:sessionId/message` or `/instructions` → queued items converted to temporary messages
3. Temporary messages sent to LLM (not saved to history)
4. Only user message + assistant response saved to `session.messages`
5. Queues cleared

## New Architecture

### Direct Message Appending
- Remove `queuedInstructions` and `queuedToolOutputs` from session state
- Immediately append instructions to `session.messages` as **system messages**
- Immediately append tool outputs to `session.messages` as **tool messages** (role: "tool")
- All messages persist in conversation history for future reference

### New Flow
1. Client calls `/text/session/:sessionId/tool-output` → outputs immediately appended to `session.messages` as **tool messages** (role: "tool", tool_call_id: "xxx")
2. Client calls `/text/session/:sessionId/instructions` → instructions immediately appended to `session.messages` as **system messages**
3. Client calls `/text/session/:sessionId/message` → user message appended, LLM called with full history, assistant response (with tool_calls if any) appended

## Implementation Changes

### 1. Type Definitions (server/llm/types.ts)

**Update `TextMessage` to support tool role:**
```typescript
export interface TextMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string; // Required when role is "tool"
  tool_calls?: ToolCall[]; // Present when assistant makes tool calls
}
```

**Remove from `TextSessionSnapshot`:**
```typescript
queuedInstructions: string[];
queuedToolOutputs: QueuedToolOutputPayload[];
```

**Remove `QueuedToolOutputPayload`** (no longer needed - tool outputs become regular messages)

### 2. Session Store (server/llm/textSessionStore.ts)

**Remove from `TextSession` interface:**
```typescript
queuedInstructions: string[];
queuedToolOutputs: QueuedToolOutputPayload[];
```

**Remove functions:**
- `queueSessionInstructions()`
- `queueSessionToolOutputs()`
- `clearSessionQueues()`

**Update `createTextSession()`:**
- Remove initialization of `queuedInstructions: []` and `queuedToolOutputs: []`

**Update `serializeSession()`:**
- Remove serialization of queued fields

### 3. API Routes (server/routes/textLLM.ts)

**Remove imports:**
```typescript
queueSessionInstructions,
queueSessionToolOutputs,
clearSessionQueues,
```

#### POST `/text/session/:sessionId/tool-output`
**Current behavior:** Queues tool outputs
**New behavior:** Append tool outputs as tool messages immediately

```typescript
router.post("/text/session/:sessionId/tool-output", (req, res) => {
  const session = getTextSession(req.params.sessionId);

  const parsedOutputs = normalizeToolOutputs(req.body?.toolOutputs ?? req.body);

  // NEW: Append tool outputs as tool messages immediately
  const toolOutputMessages = parsedOutputs.map(({ callId, output }) => ({
    role: "tool" as const,
    tool_call_id: callId,
    content: output,
  }));

  appendSessionMessages(session, toolOutputMessages);

  res.json({ success: true, session: serializeSession(session) });
});
```

#### POST `/text/session/:sessionId/instructions`
**Current behavior:** Queues instructions, processes them with queued tool outputs, clears queue
**New behavior:** Append instructions to messages, generate response immediately

```typescript
router.post("/text/session/:sessionId/instructions", async (req, res) => {
  const session = getTextSession(req.params.sessionId);

  const instructions = normalizeInstructions(req.body?.instructions ?? req.body);

  // NEW: Append instructions as system messages immediately
  const instructionMessages = instructions.map((instruction) => ({
    role: "system" as const,
    content: instruction,
  }));

  appendSessionMessages(session, instructionMessages);

  // Generate response with full conversation history
  const requestPayload: TextGenerationRequest = {
    provider: session.provider,
    model: session.model,
    messages: session.messages, // Full history, no temp messages
    ...session.defaults,
  };

  if (session.tools?.length) {
    requestPayload.tools = session.tools;
  }

  const result = await generateText(requestPayload);

  // Append assistant response (including tool_calls if present)
  if (result.text || result.toolCalls) {
    appendSessionMessages(session, [
      {
        role: "assistant",
        content: result.text || "",
        ...(result.toolCalls?.length ? { tool_calls: result.toolCalls } : {})
      },
    ]);
  }

  res.json({ success: true, result, session: serializeSession(session) });
});
```

#### POST `/text/session/:sessionId/message`
**Current behavior:** Queues new instructions, includes all queued items as temp messages, clears queue
**New behavior:** Append optional instructions to messages, send user message, no queue logic

```typescript
router.post("/text/session/:sessionId/message", async (req, res) => {
  const session = getTextSession(req.params.sessionId);

  const userContent = req.body?.content?.trim();
  const instructionsInput = req.body?.instructions;

  // NEW: If instructions provided, append them first as system messages
  if (instructionsInput) {
    const newInstructions = normalizeInstructions(instructionsInput);
    const instructionMessages = newInstructions.map((instruction) => ({
      role: "system" as const,
      content: instruction,
    }));
    appendSessionMessages(session, instructionMessages);
  }

  // Append user message
  const userMessage: TextMessage = { role: "user", content: userContent };
  appendSessionMessages(session, [userMessage]);

  // Generate response with full history
  const requestPayload: TextGenerationRequest = {
    provider: session.provider,
    model: session.model,
    messages: session.messages, // Full history, no temp messages
    ...session.defaults,
  };

  if (session.tools?.length) {
    requestPayload.tools = session.tools;
  }

  const result = await generateText(requestPayload);

  // Append assistant response (including tool_calls if present)
  if (result.text || result.toolCalls) {
    appendSessionMessages(session, [
      {
        role: "assistant",
        content: result.text || "",
        ...(result.toolCalls?.length ? { tool_calls: result.toolCalls } : {})
      },
    ]);
  }

  res.json({ success: true, result, session: serializeSession(session) });
});
```

## Benefits

1. **Simpler architecture** - No queue management, no temporary message construction
2. **Full context preservation** - LLM can reference tool outputs and instructions from earlier in the conversation
3. **Consistent message history** - All messages persisted, easier to debug and inspect
4. **Stateless client logic** - Client doesn't need to know about queue vs. permanent messages

## Migration Notes

- **Breaking change**: API response shape changes (no more `queuedInstructions`/`queuedToolOutputs` in session snapshots)
- **No data migration needed** - Session store is in-memory only
- **Voice API unaffected** - Changes only affect `server/llm/textSessionStore.ts` and `server/routes/textLLM.ts`

## Additional Considerations

### Provider-Specific Message Handling

Different LLM providers handle tool messages differently:

1. **OpenAI**: Supports `role: "tool"` with `tool_call_id` natively
2. **Anthropic**: Does not support `role: "tool"` - converts all non-user/assistant to user messages
3. **Google/Ollama**: May have different tool message formats

**Solution**: Provider adapters in `server/llm/providers/*` should handle conversion:
- OpenAI: Pass tool messages as-is
- Anthropic: Convert tool messages to user messages with formatted content
- Others: Implement appropriate conversions

### Tool Call Persistence

When the assistant makes tool calls:
```typescript
{
  role: "assistant",
  content: "",
  tool_calls: [
    { id: "call_abc123", name: "get_weather", arguments: "{\"location\":\"Tokyo\"}" }
  ]
}
```

This must be saved to `session.messages` so the subsequent tool output can reference `tool_call_id: "call_abc123"`.

## Files to Modify

1. `server/llm/types.ts` - Update `TextMessage` interface, remove queue fields from `TextSessionSnapshot`
2. `server/llm/textSessionStore.ts` - Remove queue state and functions
3. `server/routes/textLLM.ts` - Update all three endpoints to append messages immediately with proper roles
4. `server/llm/providers/openai.ts` - Update message serialization to handle tool messages and tool_calls
5. `server/llm/providers/anthropic.ts` - Add conversion logic for tool messages → user messages
6. `server/llm/providers/google.ts` - Add provider-specific tool message handling
7. `server/llm/providers/ollama.ts` - Add provider-specific tool message handling
