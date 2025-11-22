# PLAN15: Remove Text Session Management

## Problem Statement

The text-based chat mode (`text-rest`) currently uses a server-side session management system that is unnecessary and over-engineered. Unlike voice modes which require persistent WebRTC/WebSocket connections for real-time audio streaming, text mode only needs simple request/response cycles.

## Current Architecture Analysis

### Voice Mode Requirements (JUSTIFIED)
- **WebRTC/WebSocket connection**: Persistent bidirectional channel for real-time communication
- **Audio streaming**: getUserMedia, audio tracks, remote audio playback
- **Session lifecycle**: Connection setup, SDP exchange, data channel management
- **State tracking**: chatActive, connecting, conversationActive

**Files involved**:
- `src/composables/useRealtimeSession.ts` - WebRTC implementation
- `src/composables/useVoiceRealtimeSession.ts` - Voice-specific wrapper
- `src/composables/useGoogleLiveSession.ts` - Google WebSocket implementation

### Text Mode Implementation (UNNECESSARY COMPLEXITY)

**Client-side** (`src/composables/useTextSession.ts`):
1. Creates a session via `POST /api/text/session` (lines 89-168)
2. Stores session ID and manages session lifecycle
3. Sends messages via `POST /api/text/session/:sessionId/message`
4. Manages chatActive, connecting, conversationActive states

**Server-side** (`server/llm/textSessionStore.ts`):
1. In-memory Map storing up to 200 sessions (line 24)
2. 30-minute TTL with automatic cleanup (line 21)
3. Tracks per-session:
   - Conversation history (messages array)
   - System prompt
   - Tools definitions
   - Model configuration
   - Generation defaults

**API endpoints** (`server/routes/textLLM.ts`):
- `POST /api/text/session` - Create session (line 261)
- `GET /api/text/session/:sessionId` - Get session (line 330)
- `DELETE /api/text/session/:sessionId` - Delete session (line 346)
- `POST /api/text/session/:sessionId/message` - Send message (line 506)
- `POST /api/text/session/:sessionId/instructions` - Send instructions (line 360)
- `POST /api/text/session/:sessionId/tool-output` - Send tool output (line 454)

## Why Text Sessions Are Unnecessary

1. **No persistent connection needed**: Text mode uses simple HTTP requests
2. **Conversation history already tracked client-side**: `toolResults` array in App.vue
3. **Auto-created sessions**: Session is automatically created on first message (App.vue:544-551), so there's no user-visible "connect" step
4. **Server-side state is redundant**: All conversation context can be sent from client with each request
5. **Stateless API already exists**: `POST /api/text/generate` (textLLM.ts:202) works without sessions

## Proposed Solution

### Eliminate Server-Side Session Management

Convert text mode to use the existing stateless `POST /api/text/generate` endpoint directly, passing full conversation context with each request.

### Architecture Changes

**Before**:
```
User message → Create/Get session → Append to session.messages → Generate → Store response → Return
```

**After**:
```
User message → Build messages array from client state → Generate → Return
```

### Client-Side Changes

**Remove** (`src/composables/useTextSession.ts`):
- Session creation and management
- Session ID tracking
- chatActive/connecting states (for text mode only)

**Simplify** (`src/composables/useTextSession.ts`):
- `startChat()`: Becomes a no-op or simple state setter
- `sendUserMessage()`: Builds full conversation from client state, calls `/api/text/generate`
- `sendInstructions()`: Appends instruction as system message, calls `/api/text/generate`
- Remove session lifecycle management

**Keep**:
- Unified interface with voice modes via `useSessionTransport`
- Event handlers (onToolCall, onTextDelta, etc.)
- conversationActive state (indicates AI is generating response)

### Server-Side Changes

**Keep** (`server/routes/textLLM.ts`):
- `POST /api/text/generate` - Stateless generation endpoint (lines 202-259)
- `GET /text/providers` - Provider availability (lines 195-200)

**Remove**:
- Session-based endpoints (lines 261-649)
- `server/llm/textSessionStore.ts` - Entire file

**Simplify**:
- No session cleanup
- No session TTL management
- No session storage limits

### Conversation History Management

**Current**: Server maintains `session.messages` array

**Proposed**: Client builds messages array from:
1. System prompt (from useUserPreferences)
2. User messages (from toolResults with role="user")
3. Assistant responses (from toolResults with role="assistant")
4. Tool calls and outputs (from plugin execution history)

**Implementation**:
```typescript
// In useTextSession.ts
function buildMessagesFromHistory(): TextMessage[] {
  const messages: TextMessage[] = [];

  // Add system prompt
  const systemPrompt = buildInstructions();
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Build from toolResults (which already tracks conversation)
  // Extract user messages, assistant responses, tool calls
  // ... conversion logic ...

  return messages;
}
```

## Implementation Steps

### Phase 1: Client Refactoring
1. ✅ Update `useTextSession.ts` to use `/api/text/generate` instead of session endpoints
2. ✅ Implement `buildMessagesFromHistory()` to construct conversation from client state
3. ✅ Remove session creation and management logic
4. ✅ Simplify `startChat()` - no API call needed
5. ✅ Update `sendUserMessage()` to build full context
6. ✅ Update `sendInstructions()` to build full context
7. ✅ Remove session ID state and tracking

### Phase 2: Testing
1. ✅ Test text-only conversations
2. ✅ Test tool calling in text mode
3. ✅ Test instruction following
4. ✅ Test switching between voice and text modes
5. ✅ Test multiple concurrent conversations (via "New conversation" button)

### Phase 3: Server Cleanup
1. ✅ Remove session-based endpoints from `textLLM.ts`
2. ✅ Delete `textSessionStore.ts`
3. ✅ Update server types if needed
4. ✅ Remove unused imports

### Phase 4: Documentation
1. ✅ Update CLAUDE.md to reflect stateless text architecture
2. ✅ Add comments explaining conversation history management
3. ✅ Document differences between voice and text modes

## Benefits

1. **Simplified architecture**: No server-side session management for text mode
2. **Reduced server memory**: No need to store 200 sessions with conversation history
3. **No session expiration issues**: No 30-minute TTL limitations
4. **Clearer separation**: Voice modes need sessions, text mode doesn't
5. **Easier horizontal scaling**: Stateless server can scale trivially
6. **Client-side conversation control**: User has full control over conversation history
7. **Reduced code complexity**: ~400 lines of session management code removed

## Risks and Mitigations

### Risk 1: Larger request payloads
**Impact**: Each request includes full conversation history
**Mitigation**:
- Most conversations are short (<10 messages)
- Could add client-side conversation length limits
- Compression already handled by HTTP/2

### Risk 2: Loss of conversation history on page refresh
**Impact**: Users lose conversation context if they refresh
**Mitigation**:
- Already happens in current implementation (sessions are in-memory)
- Could add localStorage persistence if needed
- toolResults already persisted in component state during session

### Risk 3: Breaking existing API contracts
**Impact**: External tools using session endpoints break
**Mitigation**:
- Session endpoints are not documented as public API
- Used only by the client app
- Can keep deprecated endpoints with warning if needed

### Risk 4: Different behavior between voice and text
**Impact**: Voice maintains server-side conversation, text doesn't
**Mitigation**:
- This is acceptable - they're fundamentally different transports
- Unified client-side interface via useSessionTransport remains
- Conversation history still managed consistently client-side

## Success Criteria

- ✅ Text mode conversations work identically to current behavior
- ✅ Tool calling works in text mode
- ✅ Instructions and follow-ups work
- ✅ Voice modes remain unaffected
- ✅ No server-side session storage for text mode
- ✅ Reduced server memory footprint
- ✅ Simpler codebase (fewer lines, less complexity)

## Future Considerations

### Optional: Add localStorage persistence
If users want conversation history across page refreshes:
```typescript
// Save toolResults to localStorage
localStorage.setItem('conversation_history', JSON.stringify(toolResults));

// Restore on mount
const saved = localStorage.getItem('conversation_history');
if (saved) {
  toolResults.value = JSON.parse(saved);
}
```

### Optional: Conversation export/import
Allow users to download/upload conversation history as JSON for archival or sharing.

### Optional: Streaming responses
The stateless API could be enhanced to support Server-Sent Events (SSE) for streaming text responses without requiring sessions.

## Timeline Estimate

- Phase 1 (Client refactoring): 2-4 hours
- Phase 2 (Testing): 1-2 hours
- Phase 3 (Server cleanup): 30 minutes
- Phase 4 (Documentation): 30 minutes

**Total**: ~4-7 hours of development time

## Conclusion

The text session management system is a remnant of trying to unify voice and text under a single "session" abstraction. While sessions are essential for voice modes (WebRTC connections), they add unnecessary complexity for text mode. Removing them will:

- Simplify the architecture
- Reduce server-side state
- Make the codebase more maintainable
- Have no negative impact on user experience

This refactoring is recommended and low-risk.
