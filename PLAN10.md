# PLAN10: Google Live API Integration

## Overview

Add Google's Live API as an alternative voice transport to the existing OpenAI Realtime API, leveraging the existing transport abstraction layer (`useSessionTransport`). This implementation will coexist with the current OpenAI WebRTC transport without modifying existing functionality.

## Architecture

The application already has a transport abstraction layer that supports multiple session types:
- `voice-realtime` - OpenAI WebRTC (existing)
- `text-rest` - REST-based text chat (existing)
- `voice-google-live` - Google Live API WebSocket (new)

All transports implement the same `UseRealtimeSessionReturn` interface, enabling seamless switching between providers.

## Key Differences: OpenAI vs Google

| Aspect | OpenAI Realtime API | Google Live API |
|--------|-------------------|----------------|
| Protocol | WebRTC (P2P) | WebSocket |
| Audio Format | Handled by WebRTC | 16-bit PCM, 16kHz in / 24kHz out |
| Connection | RTCPeerConnection + data channel | Standard WebSocket |
| Message Format | OpenAI proprietary events | Google Live API events |
| Audio Routing | RTC audio tracks | Manual encoding/decoding |
| Model | GPT Realtime models | gemini-2.5-flash-native-audio-preview |

## Phase 1: Core Infrastructure

### 1.1 Server-side API Endpoint

**File: `server/routes/api.ts`**

Add endpoint to provide Google API key:

```typescript
// Add to /api/start response
const googleApiKey = process.env.GOOGLE_API_KEY;
const hasGoogleApiKey = !!googleApiKey;

// Update StartApiResponse interface
interface StartApiResponse {
  // ... existing fields
  googleApiKey?: string;
  hasGoogleApiKey: boolean;
}
```

**Environment Variable:**
- `GOOGLE_API_KEY` - Google Cloud API key with Gemini API access

### 1.2 Model Configuration

**File: `src/config/models.ts`**

Add Google Live models:

```typescript
export interface GoogleLiveModelOption {
  id: string;
  label: string;
  description?: string;
}

export const GOOGLE_LIVE_MODELS: GoogleLiveModelOption[] = [
  {
    id: "gemini-2.5-flash-native-audio-preview",
    label: "Gemini 2.5 Flash Native Audio",
    description: "Google's native audio model for real-time conversations"
  }
];

export const DEFAULT_GOOGLE_LIVE_MODEL_ID = GOOGLE_LIVE_MODELS[0].id;
```

### 1.3 Transport Kind Extension

**File: `src/composables/useSessionTransport.ts`**

Update `SessionTransportKind` type:

```typescript
export type SessionTransportKind =
  | "voice-realtime"      // OpenAI WebRTC
  | "text-rest"           // REST text
  | "voice-google-live";  // Google WebSocket (new)
```

Update capabilities for Google Live:

```typescript
if (transportKind.value === "voice-google-live") {
  return {
    supportsAudioInput: true,
    supportsAudioOutput: true,
    supportsText: true,
  };
}
```

## Phase 2: WebSocket Audio Implementation

### 2.1 Audio Encoding/Decoding Utilities

**New File: `src/utils/audioCodec.ts`**

Implement PCM audio conversion utilities:

```typescript
/**
 * Convert Float32Array audio data from getUserMedia to 16-bit PCM
 * @param float32Data - Audio data from AudioContext
 * @param targetSampleRate - Target sample rate (16000 for Google)
 * @returns Base64-encoded PCM data
 */
export function encodeAudioToPCM16(
  float32Data: Float32Array,
  targetSampleRate: number
): string;

/**
 * Convert 16-bit PCM to Float32Array for Web Audio API playback
 * @param base64PCM - Base64-encoded PCM data from Google
 * @param sampleRate - Sample rate (24000 from Google)
 * @returns Float32Array audio data
 */
export function decodePCM16ToFloat32(
  base64PCM: string,
  sampleRate: number
): Float32Array;

/**
 * Resample audio from source rate to target rate
 */
export function resampleAudio(
  audioData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array;
```

### 2.2 Audio Stream Manager

**New File: `src/utils/audioStreamManager.ts`**

Handle continuous audio capture and playback:

```typescript
export class AudioStreamManager {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private playbackQueue: Float32Array[] = [];

  /**
   * Start capturing audio from microphone
   * Emits PCM chunks via callback
   */
  startCapture(
    stream: MediaStream,
    onAudioChunk: (pcm: string) => void
  ): void;

  /**
   * Stop capturing audio
   */
  stopCapture(): void;

  /**
   * Queue audio for playback
   */
  queueAudio(pcmData: string): void;

  /**
   * Start playing queued audio
   */
  startPlayback(): void;

  /**
   * Stop playback
   */
  stopPlayback(): void;
}
```

## Phase 3: Google Live Session Implementation

### 3.1 Core Session Composable

**New File: `src/composables/useGoogleLiveSession.ts`**

Main implementation following the `UseRealtimeSessionReturn` interface:

```typescript
import { ref, shallowRef } from "vue";
import type { StartApiResponse } from "../../server/types";
import type { BuildContext, ToolCallMessage } from "./types";
import type {
  RealtimeSessionEventHandlers,
  RealtimeSessionOptions,
  UseRealtimeSessionReturn
} from "./useRealtimeSession";
import { AudioStreamManager } from "../utils/audioStreamManager";
import { DEFAULT_GOOGLE_LIVE_MODEL_ID } from "../config/models";

export type UseGoogleLiveSessionOptions = RealtimeSessionOptions;
export type UseGoogleLiveSessionReturn = UseRealtimeSessionReturn;

interface GoogleLiveState {
  ws: WebSocket | null;
  localStream: MediaStream | null;
  audioManager: AudioStreamManager | null;
}

export function useGoogleLiveSession(
  options: UseGoogleLiveSessionOptions
): UseGoogleLiveSessionReturn {
  // State management
  const chatActive = ref(false);
  const conversationActive = ref(false);
  const connecting = ref(false);
  const isMuted = ref(false);
  const startResponse = ref<StartApiResponse | null>(null);

  // Google Live specific state
  const googleLive: GoogleLiveState = {
    ws: null,
    localStream: null,
    audioManager: null
  };

  // Event handlers
  let handlers: RealtimeSessionEventHandlers = {
    ...(options.handlers ?? {})
  };

  // ... Implementation details below
}
```

### 3.2 WebSocket Connection Flow

```typescript
const startChat = async () => {
  if (chatActive.value || connecting.value) return;

  connecting.value = true;

  try {
    // 1. Fetch Google API key
    const response = await fetch("/api/start");
    startResponse.value = await response.json();

    if (!startResponse.value?.googleApiKey) {
      throw new Error("No Google API key available");
    }

    // 2. Build instructions and tools
    const instructions = options.buildInstructions({
      startResponse: startResponse.value
    });
    const tools = options.buildTools({
      startResponse: startResponse.value
    });
    const modelId = options.getModelId?.({
      startResponse: startResponse.value
    }) ?? DEFAULT_GOOGLE_LIVE_MODEL_ID;

    // 3. Establish WebSocket connection
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${startResponse.value.googleApiKey}`;

    googleLive.ws = new WebSocket(wsUrl);

    // 4. Setup event handlers
    googleLive.ws.onopen = () => handleWebSocketOpen(instructions, tools, modelId);
    googleLive.ws.onmessage = (event) => handleWebSocketMessage(event);
    googleLive.ws.onerror = (error) => handleWebSocketError(error);
    googleLive.ws.onclose = () => handleWebSocketClose();

    // 5. Request microphone access
    googleLive.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // 6. Initialize audio stream manager
    googleLive.audioManager = new AudioStreamManager();
    googleLive.audioManager.startCapture(
      googleLive.localStream,
      (pcmChunk) => sendAudioChunk(pcmChunk)
    );

    chatActive.value = true;
  } catch (error) {
    console.error("Failed to start Google Live session:", error);
    stopChat();
    alert("Failed to start Google Live session. Check console for details.");
  } finally {
    connecting.value = false;
  }
};
```

### 3.3 Message Protocol Handling

Google Live API uses different message formats:

**Outgoing Messages:**
```typescript
// Setup message (on WebSocket open)
{
  "setup": {
    "model": "models/gemini-2.5-flash-native-audio-preview",
    "generation_config": {
      "response_modalities": ["AUDIO"],
      "speech_config": {
        "voice_config": { "prebuilt_voice_config": { "voice_name": "Aoede" } }
      }
    },
    "system_instruction": { "parts": [{ "text": instructions }] },
    "tools": [...] // Converted to Google format
  }
}

// Audio chunk
{
  "realtime_input": {
    "media_chunks": [{
      "data": base64EncodedPCM,
      "mime_type": "audio/pcm"
    }]
  }
}

// User text message
{
  "client_content": {
    "turns": [{
      "role": "user",
      "parts": [{ "text": message }]
    }],
    "turn_complete": true
  }
}

// Function call output
{
  "tool_response": {
    "function_responses": [{
      "id": callId,
      "name": toolName,
      "response": { "result": output }
    }]
  }
}
```

**Incoming Messages:**
```typescript
// Parse and handle different event types:
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        { "text": "..." },              // Text response
        { "inlineData": { ... } },      // Audio chunk
        { "functionCall": { ... } }     // Tool call
      ]
    },
    "turnComplete": true
  }
}
```

### 3.4 Tool Call Handling

Google's function calling format differs from OpenAI:

```typescript
// Google format
{
  "functionCall": {
    "name": "generate_image",
    "id": "call_abc123",
    "args": {
      "prompt": "a sunset"
    }
  }
}

// Need to convert to internal format:
const convertGoogleToolCall = (functionCall: any): void => {
  const toolCallMsg: ToolCallMessage = {
    type: "response.function_call_arguments.done",
    call_id: functionCall.id,
    name: functionCall.name
  };

  const argStr = JSON.stringify(functionCall.args);
  handlers.onToolCall?.(toolCallMsg, functionCall.id, argStr);
};
```

### 3.5 Audio Playback

```typescript
const handleAudioChunk = (audioData: string) => {
  if (!googleLive.audioManager) return;

  // Queue audio for playback (24kHz from Google)
  googleLive.audioManager.queueAudio(audioData);

  // Start playback if not already playing
  if (!isPlaying) {
    googleLive.audioManager.startPlayback();
  }
};
```

## Phase 4: Transport Integration

### 4.1 Update Session Transport

**File: `src/composables/useSessionTransport.ts`**

Add Google Live session:

```typescript
import { useGoogleLiveSession } from "./useGoogleLiveSession";

export function useSessionTransport(
  options: UseSessionTransportOptions
): UseSessionTransportReturn {
  // ... existing code ...

  const googleLiveSession = useGoogleLiveSession(realtimeOptions);

  const activeSession = computed(() => {
    if (transportKind.value === "text-rest") return textSession;
    if (transportKind.value === "voice-google-live") return googleLiveSession;
    return voiceSession; // default to OpenAI
  });

  const capabilities = computed<SessionTransportCapabilities>(() => {
    if (transportKind.value === "voice-realtime") {
      return {
        supportsAudioInput: true,
        supportsAudioOutput: true,
        supportsText: true,
      };
    }

    if (transportKind.value === "voice-google-live") {
      return {
        supportsAudioInput: true,
        supportsAudioOutput: true,
        supportsText: true,
      };
    }

    return {
      supportsAudioInput: false,
      supportsAudioOutput: false,
      supportsText: true,
    };
  });

  // Register handlers for all sessions
  return {
    // ... existing code ...
    registerEventHandlers: (handlers) => {
      voiceSession.registerEventHandlers(handlers);
      textSession.registerEventHandlers(handlers);
      googleLiveSession.registerEventHandlers(handlers); // Add this
    },
    transportKind,
    capabilities,
  };
}
```

### 4.2 User Preferences Storage

**File: `src/composables/useUserPreferences.ts`**

Add transport selection to user preferences:

```typescript
// Add new preference field
const transportKind = ref<SessionTransportKind>("voice-realtime");

// Add to localStorage persistence
watch(transportKind, (value) => {
  localStorage.setItem("transport_kind_v1", value);
});

// Load on initialization
const savedTransportKind = localStorage.getItem("transport_kind_v1");
if (savedTransportKind) {
  transportKind.value = savedTransportKind as SessionTransportKind;
}

// Return in composable
return {
  // ... existing fields ...
  transportKind,
};
```

## Phase 5: UI Changes

### 5.1 Transport Selector in Sidebar

**File: `src/components/Sidebar.vue`**

Add dropdown in settings section:

```vue
<div class="settings-section">
  <label>Voice Provider</label>
  <select v-model="transportKind" @change="$emit('update:transport-kind', $event.target.value)">
    <option value="voice-realtime">OpenAI Realtime (WebRTC)</option>
    <option value="voice-google-live">Google Live API (WebSocket)</option>
    <option value="text-rest">Text Only (REST)</option>
  </select>

  <!-- Show model selector based on transport -->
  <label v-if="transportKind === 'voice-realtime'">OpenAI Model</label>
  <select v-if="transportKind === 'voice-realtime'" v-model="modelId">
    <option v-for="model in REALTIME_MODELS" :value="model.id">
      {{ model.label }}
    </option>
  </select>

  <label v-if="transportKind === 'voice-google-live'">Google Model</label>
  <select v-if="transportKind === 'voice-google-live'" v-model="googleModelId">
    <option v-for="model in GOOGLE_LIVE_MODELS" :value="model.id">
      {{ model.label }}
    </option>
  </select>
</div>
```

### 5.2 Status Indicator

Show which transport is active:

```vue
<div class="transport-status">
  <span v-if="transportKind === 'voice-realtime'" class="badge">
    🔊 OpenAI
  </span>
  <span v-if="transportKind === 'voice-google-live'" class="badge">
    🔊 Google
  </span>
  <span v-if="transportKind === 'text-rest'" class="badge">
    💬 Text
  </span>
</div>
```

## Phase 6: Tool Format Conversion

### 6.1 Tool Definition Converter

**New File: `src/utils/toolConverter.ts`**

Convert between OpenAI and Google tool formats:

```typescript
/**
 * Convert OpenAI tool definition to Google function declaration format
 */
export function convertToGoogleToolFormat(openAITool: any): any {
  return {
    function_declarations: [{
      name: openAITool.name,
      description: openAITool.description,
      parameters: convertJsonSchemaToGoogleFormat(openAITool.parameters)
    }]
  };
}

/**
 * Convert JSON Schema (OpenAI format) to Google's format
 */
function convertJsonSchemaToGoogleFormat(schema: any): any {
  // Google uses similar but slightly different property names
  return {
    type: schema.type,
    properties: schema.properties,
    required: schema.required
  };
}
```

## Phase 7: Testing Strategy

### 7.1 Unit Tests

Create tests for:
- Audio encoding/decoding utilities
- Tool format conversion
- WebSocket message parsing
- Audio stream management

### 7.2 Integration Tests

Test scenarios:
1. **Session Lifecycle**
   - Start chat → WebSocket connects
   - Stop chat → WebSocket closes cleanly
   - Automatic reconnection on disconnect

2. **Audio Flow**
   - Microphone capture → PCM encoding → WebSocket send
   - WebSocket receive → PCM decode → Audio playback
   - Mute/unmute functionality

3. **Tool Calling**
   - Tool call from Google → Execute plugin → Send result back
   - Verify tool format conversion
   - Test multiple concurrent tool calls

4. **Transport Switching**
   - Switch from OpenAI to Google mid-session
   - Verify state cleanup
   - Verify audio device release

### 7.3 Manual Testing

Test with:
- Different browsers (Chrome, Firefox, Safari)
- Different microphone devices
- Network interruptions
- API key validation
- Error handling

## Phase 8: Error Handling & Edge Cases

### 8.1 Error Scenarios

Handle gracefully:
- Missing Google API key
- WebSocket connection failure
- Audio device permission denied
- Network disconnection mid-session
- Invalid audio format from Google
- Tool execution errors
- API rate limiting

### 8.2 Error Recovery

Implement:
- Automatic WebSocket reconnection (with exponential backoff)
- Audio buffer overflow handling
- Graceful degradation when audio fails
- User-friendly error messages

## Phase 9: Documentation

### 9.1 Environment Variables

Update `.env.example`:

```bash
# Google Live API (optional, for voice chat with Google)
GOOGLE_API_KEY=your_google_api_key_here
```

### 9.2 README Updates

Add section on Google Live API setup:
- How to obtain Google API key
- How to enable Gemini API
- How to switch between providers
- Comparison of features

### 9.3 Code Comments

Add comprehensive JSDoc comments to:
- All public functions
- Complex audio processing logic
- WebSocket message handlers
- Format conversion utilities

## Implementation Checklist

### Phase 1: Infrastructure
- [ ] Add `GOOGLE_API_KEY` to server environment
- [ ] Update `/api/start` endpoint to return Google key
- [ ] Add Google Live models to `src/config/models.ts`
- [ ] Update `SessionTransportKind` type

### Phase 2: Audio
- [ ] Implement `src/utils/audioCodec.ts`
- [ ] Implement `src/utils/audioStreamManager.ts`
- [ ] Test audio encoding/decoding
- [ ] Test audio capture and playback

### Phase 3: Session
- [ ] Create `src/composables/useGoogleLiveSession.ts`
- [ ] Implement WebSocket connection logic
- [ ] Implement message handlers
- [ ] Implement tool call conversion
- [ ] Implement audio streaming

### Phase 4: Integration
- [ ] Update `useSessionTransport.ts`
- [ ] Add Google session to transport selector
- [ ] Update capabilities mapping
- [ ] Register event handlers

### Phase 5: UI
- [ ] Add transport selector to Sidebar
- [ ] Add Google model selector
- [ ] Add transport status indicator
- [ ] Update settings UI

### Phase 6: Tools
- [ ] Implement `src/utils/toolConverter.ts`
- [ ] Test tool format conversion
- [ ] Verify all plugins work with Google format

### Phase 7: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual testing across browsers
- [ ] Test error scenarios

### Phase 8: Polish
- [ ] Error handling
- [ ] Reconnection logic
- [ ] Loading states
- [ ] User feedback

### Phase 9: Documentation
- [ ] Update `.env.example`
- [ ] Update README
- [ ] Add code comments
- [ ] Create migration guide

## Files to Create

1. `src/composables/useGoogleLiveSession.ts` - Main session implementation
2. `src/utils/audioCodec.ts` - Audio encoding/decoding
3. `src/utils/audioStreamManager.ts` - Audio stream management
4. `src/utils/toolConverter.ts` - Tool format conversion
5. `src/config/googleLiveModels.ts` - Google model configurations (optional, can add to existing models.ts)

## Files to Modify

1. `server/routes/api.ts` - Add Google API key endpoint
2. `server/types.ts` - Update `StartApiResponse` interface
3. `src/composables/useSessionTransport.ts` - Add Google Live transport
4. `src/composables/useUserPreferences.ts` - Add transport preference
5. `src/config/models.ts` - Add Google Live models
6. `src/components/Sidebar.vue` - Add transport selector UI
7. `src/App.vue` - Pass transport kind to session
8. `.env.example` - Add Google API key
9. `README.md` - Add setup instructions

## Risk Mitigation

### Technical Risks

1. **Audio Latency**
   - Risk: Manual encoding/decoding may add latency
   - Mitigation: Use Web Audio API efficiently, implement audio buffering

2. **Browser Compatibility**
   - Risk: Web Audio API differences across browsers
   - Mitigation: Test on major browsers, provide fallbacks

3. **WebSocket Stability**
   - Risk: Connection drops during long sessions
   - Mitigation: Implement automatic reconnection with state recovery

4. **Format Conversion**
   - Risk: Tool format conversion may lose information
   - Mitigation: Comprehensive testing, validation layer

### User Experience Risks

1. **Confusion Between Providers**
   - Risk: Users don't understand differences
   - Mitigation: Clear UI labels, help text, feature comparison

2. **API Key Management**
   - Risk: Users struggle with API key setup
   - Mitigation: Detailed documentation, helpful error messages

3. **Audio Quality**
   - Risk: Google audio quality differs from OpenAI
   - Mitigation: Document differences, allow quality settings

## Success Metrics

- [ ] Google Live session connects successfully
- [ ] Audio input/output works without glitches
- [ ] Tool calling works with all existing plugins
- [ ] Users can switch between OpenAI and Google seamlessly
- [ ] No regression in existing OpenAI functionality
- [ ] Error handling provides clear feedback
- [ ] Performance is comparable to OpenAI WebRTC

## Future Enhancements

1. **Video Support**
   - Google Live API supports video streaming
   - Could add camera input for multimodal interactions

2. **Client-to-Server Architecture**
   - Currently direct client-to-Google connection
   - Could add server relay for enterprise scenarios

3. **Ephemeral Tokens**
   - Use Google's ephemeral token system instead of API keys
   - Improved security for production deployments

4. **Quality Settings**
   - Allow users to adjust audio quality/bitrate
   - Trade latency vs quality

5. **Cost Tracking**
   - Display estimated costs for each provider
   - Help users make informed choices

## Conclusion

This plan provides a comprehensive roadmap for integrating Google's Live API as an alternative to OpenAI's Realtime API. The implementation leverages the existing transport abstraction layer, minimizing impact on current functionality while providing users with choice and flexibility.

The modular approach ensures that:
- Existing OpenAI functionality remains unchanged
- Code is maintainable and testable
- Users can easily switch between providers
- Future providers can be added with similar patterns
