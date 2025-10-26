# PLAN8: Voice Recording & MulmoScript Export for Listener Mode

## Overview

Enable voice recording during chat sessions with automatic segmentation on image generation events. Store sessions in the `output` folder following mulmocast's pattern, with Whisper-transcribed audio, generated images, and MulmoScript JSON.

## Goals

1. Record user's voice during chat sessions
2. Segment audio automatically on each image generation
3. Store audio segments in output folder (server-side)
4. Transcribe audio segments using OpenAI Whisper
5. Generate MulmoScript with transcriptions, audio files, and images
6. Allow users to access files from output folder or use mulmocast CLI

## Architecture

### File Storage Pattern (Following mulmocast)

```
output/
├── {session-uuid}.json           # MulmoScript
├── audio/
│   └── {session-uuid}/
│       ├── {beat1-id}.webm      # Recorded audio segment 1
│       ├── {beat2-id}.webm      # Recorded audio segment 2
│       └── ...
└── images/
    └── {session-uuid}/
        ├── {beat1-id}.png       # Generated image 1
        ├── {beat2-id}.png       # Generated image 2
        └── ...
```

### Components to Modify/Create

#### 1. useRealtimeSession.ts
**Additions:**
- MediaRecorder integration for capturing `localStream` audio
- Audio chunk accumulation per segment
- Recording state management (isRecording ref)
- Methods: `startRecording()`, `stopRecording()`, `getAudioSegment()`

**Data Structures:**
```typescript
interface AudioSegmentData {
  blob: Blob;              // Audio data (webm/opus format)
  timestamp: number;       // When segment was created
  duration: number;        // Segment duration in seconds
}

interface WebRtcState {
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  mediaRecorder: MediaRecorder | null;      // NEW
  audioChunks: Blob[];                      // NEW: Current segment chunks
  recordingStartTime: number;               // NEW: Current segment start
}
```

**Recording Logic:**
- `startRecording()`: Initialize MediaRecorder when chat starts (if enabled)
- `getAudioSegment()`: Stop current MediaRecorder, create Blob from chunks, restart new segment
- `stopRecording()`: Stop MediaRecorder and cleanup

#### 2. useToolResults.ts
**Additions:**
- Store audio segment blobs with image generation tool results
- Track session UUID for file organization
- Provide data for export to server

**Data Structures:**
```typescript
interface ToolResult {
  // ... existing fields
  audioSegmentData?: AudioSegmentData;  // NEW: Audio blob for this result
}
```

**Logic:**
- When generateImage or editImage tool completes:
  1. Call `realtimeSession.getAudioSegment()` to capture audio since last image
  2. Attach `AudioSegmentData` to the `ToolResult`
  3. Continue recording for next segment

#### 3. useUserPreferences.ts
**Additions:**
- Recording preference for listener mode
- localStorage persistence

```typescript
const recordingEnabled = ref<boolean>(false);
```

**localStorage key:**
- `recording_enabled_listener_v1`: boolean

#### 4. New: useSessionRecording.ts (composable)
**Purpose:** Manage session recording state and export

**State:**
```typescript
const sessionUuid = ref<string | null>(null);
const isExporting = ref<boolean>(false);
const exportError = ref<string | null>(null);
```

**Methods:**
- `startSession()`: Generate UUID for session
- `exportSession(toolResults: ToolResult[])`: Send data to server for processing
- `clearSession()`: Reset session state

**Export Flow:**
1. Gather all tool results with image generation and audio segments
2. For each result:
   - Upload audio blob to `/api/save-audio-segment`
   - Get audio file path back
3. Call `/api/transcribe-segments` with all audio paths
4. Call `/api/save-mulmoscript` with transcriptions, audio paths, image paths, UUID
5. Server saves MulmoScript JSON to `output/{uuid}.json`
6. UI shows success message with output folder path

#### 5. Server API Routes

**New endpoint 1:** `/api/save-audio-segment`
```typescript
POST /api/save-audio-segment
Content-Type: multipart/form-data

Request:
- audio: File (webm/opus audio blob)
- sessionUuid: string
- beatId: string

Response:
{
  success: true,
  audioPath: string  // e.g., "/output/audio/{uuid}/{beatId}.webm"
}
```

**New endpoint 2:** `/api/transcribe-segments`
```typescript
POST /api/transcribe-segments
Content-Type: application/json

Request:
{
  audioPaths: string[]  // Array of audio file paths to transcribe
}

Response:
{
  transcriptions: Array<{
    path: string,
    text: string,
    duration: number,
    language: string
  }>
}
```

**New endpoint 3:** `/api/save-mulmoscript`
```typescript
POST /api/save-mulmoscript
Content-Type: application/json

Request:
{
  sessionUuid: string,
  beats: Array<{
    id: string,
    text: string,        // Whisper transcription
    audio: string,       // Path to audio file
    image: string        // Path to image file
  }>
}

Response:
{
  success: true,
  scriptPath: string,   // e.g., "output/{uuid}.json"
  outputDir: string     // e.g., "output/"
}
```

**Implementation:**
- `/api/save-audio-segment`: Save audio blob to `output/audio/{uuid}/{beatId}.webm`
- `/api/transcribe-segments`: Call OpenAI Whisper API for each audio file, return transcriptions
- `/api/save-mulmoscript`: Build MulmoScript JSON and save to `output/{uuid}.json`

### UI Components

#### 1. Sidebar.vue Modifications
**Add recording controls (listener mode only):**
- Recording indicator (pulsing red dot when active)
- Toggle switch for "Enable Recording"
- "Export Session" button (visible when recording enabled and has data)
- Export status display (transcribing, saving, ready)
- Link to output folder after export

**Visual indicators:**
- Pulsing red dot icon when recording
- Audio segment count (e.g., "3 segments recorded")
- Export progress (e.g., "Transcribing 3/5...")

#### 2. Settings/Preferences UI
**Recording preference:**
- [ ] Enable voice recording in listener mode
- Privacy notice about voice recording

## Data Flow

### Recording Flow

```
User enables recording preference
  ↓
User starts chat in listener mode
  ↓
App checks preference → startRecording()
  ↓
MediaRecorder begins capturing localStream
  ↓
User speaks, images are generated
  ↓
First image generation completes
  ↓
getAudioSegment() called
  ↓
- MediaRecorder stops
- Audio chunks combined into Blob
- AudioSegmentData attached to ToolResult (with beat ID)
- MediaRecorder restarts for next segment
  ↓
Process repeats for each image
  ↓
Chat ends → stopRecording()
```

### Export Flow

```
User clicks "Export Session"
  ↓
For each ToolResult with audio:
  ↓
  Create FormData with audio blob
  ↓
  Upload via /api/save-audio-segment
  ↓
  Receive audio file path
  ↓
Collect all audio paths
  ↓
Call /api/transcribe-segments
  ↓
Server transcribes each audio file via Whisper API
  ↓
Receive transcriptions array
  ↓
Build beats array:
  {
    id: beatId,
    text: transcription,
    audio: `/output/audio/{uuid}/{beatId}.webm`,
    image: `/output/images/{uuid}/{beatId}.png`
  }
  ↓
Call /api/save-mulmoscript
  ↓
Server saves MulmoScript to output/{uuid}.json
  ↓
Show success: "Session saved to output/{uuid}"
```

## Implementation Steps

### Phase 1: Recording Infrastructure
1. Add MediaRecorder to useRealtimeSession
2. Implement startRecording/stopRecording methods
3. Add audio chunk accumulation logic
4. Create getAudioSegment method
5. Add recording state refs (isRecording)
6. Test audio recording quality

### Phase 2: Segmentation Integration
1. Modify useToolResults to detect image generation tools
2. Call getAudioSegment on image tool completion
3. Attach AudioSegmentData to ToolResult with beat ID
4. Restart recording for next segment
5. Test segmentation timing

### Phase 3: User Preferences
1. Add recordingEnabled to useUserPreferences
2. Add localStorage persistence
3. Wire up auto-start in listener mode
4. Test preference persistence

### Phase 4: Session Recording Composable
1. Create useSessionRecording composable
2. Add session UUID generation
3. Implement export orchestration logic
4. Add export state management
5. Test export flow

### Phase 5: Server API Endpoints
1. Add /api/save-audio-segment endpoint
   - Save blob to output/audio/{uuid}/{beatId}.webm
   - Return audio file path
2. Add /api/transcribe-segments endpoint
   - Accept array of audio file paths
   - Call OpenAI Whisper API for each
   - Return transcriptions
3. Add /api/save-mulmoscript endpoint
   - Build MulmoScript with beats
   - Save to output/{uuid}.json
   - Return script path
4. Add error handling and validation
5. Test all endpoints

### Phase 6: UI Integration
1. Add recording toggle to Sidebar (listener mode only)
2. Create recording indicator component
3. Add "Export Session" button with state
4. Implement export progress UI
5. Show output folder path on success
6. Add privacy notice for recording
7. Test UI flows

### Phase 7: Testing & Polish
1. Test recording quality across browsers
2. Test segmentation accuracy
3. Test transcription quality
4. Verify MulmoScript format compatibility
5. Test error handling
6. Add loading states
7. Optimize performance

## Dependencies

### NPM Packages
No new client-side dependencies needed.

### Server Dependencies
Already have:
- `mulmocast`: For MulmoScript types and utilities
- `express`: For API routes
- `fs/promises`: For file operations

### APIs Required
- OpenAI Whisper API (for transcription)
- Already have: OpenAI Realtime API

## Open Questions & Decisions

### 1. Transcription Fallback
**Question:** What text should we use if Whisper transcription fails?

**Decision:** Use tool result title/message as fallback
- Example: "Generated image of sunset over mountains"

### 2. Audio Format
**Question:** What audio format should MediaRecorder use?

**Options:**
- webm/opus (best compression, browser support)
- audio/webm
- audio/mp4 (if supported)

**Decision:** Try webm/opus first, with fallback to audio/webm

### 3. Privacy & Consent
**Question:** How explicit should recording consent be?

**Decision:**
- First time: Show modal explaining voice recording
- Toggle in UI with clear label
- Privacy notice in settings

### 4. Session Lifecycle
**Question:** When should session UUID be generated?

**Decision:** Generate UUID when recording starts (when chat starts with recording enabled)

### 5. Export Trigger
**Question:** When should export happen?

**Options:**
- A. Manual button click only
- B. Auto-export when chat ends
- C. Both

**Decision:** Manual button click only (A) - gives user control

### 6. Beat ID Generation
**Question:** How to ensure beat IDs match between audio segments and images?

**Decision:** Use the same beat ID (uuid) that's already generated for image tool results

### 7. MulmoScript Format
**Question:** What MulmoScript structure should we use?

**Decision:** Minimal structure focusing on beats:
```json
{
  "$mulmocast": { "version": "1.1" },
  "title": "Listener Session {date}",
  "lang": "{user language}",
  "beats": [
    {
      "id": "{beat-uuid}",
      "text": "{whisper transcription}",
      "audio": "/output/audio/{uuid}/{beat-uuid}.webm",
      "image": "/output/images/{uuid}/{beat-uuid}.png"
    }
  ]
}
```

## Technical Considerations

### Browser Compatibility
- MediaRecorder API: Chrome 47+, Firefox 25+, Safari 14.1+
- Already required: getUserMedia, WebRTC (for Realtime API)

### Performance
- MediaRecorder overhead: Minimal (hardware-accelerated)
- Memory: Store audio chunks temporarily, upload to server
- Server: Store files in output folder (same as mulmocast)

### Error Handling
- MediaRecorder not supported → Disable feature, show message
- Audio upload fails → Show error, allow retry
- Transcription fails → Use fallback text
- Server errors → Show error message, preserve client data

### Storage
- Client: Keep audio blobs in memory until uploaded
- Server: Store in `output` folder structure
- Cleanup: Consider adding cleanup task for old sessions

### Security
- Validate session UUIDs
- Sanitize file paths
- Rate limit transcription API calls
- Check audio file sizes

## Success Criteria

1. ✅ User can enable recording in listener mode via UI toggle
2. ✅ Audio segments automatically on each image generation
3. ✅ Audio quality is clear (suitable for Whisper transcription)
4. ✅ Transcriptions are accurate (>85% word accuracy)
5. ✅ MulmoScript saved to output folder with correct structure
6. ✅ Files organized following mulmocast pattern
7. ✅ Privacy consent is clear and explicit
8. ✅ Error states handled gracefully
9. ✅ Performance impact is negligible

## Future Enhancements

1. **Real-time transcription preview** during recording
2. **Manual segment editing** (trim, re-record)
3. **Custom beat text** (override transcription)
4. **Session recovery** (persist state across page refresh)
5. **Direct mulmocast integration** (one-click video generation)
6. **Session browser** (view past sessions from output folder)
7. **Audio enhancement** (noise reduction, normalization)
8. **Multi-speaker detection** (diarization)
9. **Export to other formats** (YAML, custom templates)
10. **Cloud storage integration** (upload to S3, etc.)

## Timeline Estimate

- Phase 1 (Recording): 3-4 hours
- Phase 2 (Segmentation): 2 hours
- Phase 3 (Preferences): 1 hour
- Phase 4 (Session Composable): 2 hours
- Phase 5 (Server APIs): 4-5 hours
- Phase 6 (UI): 3 hours
- Phase 7 (Testing): 3 hours

**Total: ~18-21 hours** for complete implementation

## Notes

- This feature is listener-mode specific initially
- Can be expanded to other modes later if useful
- Follows existing patterns (mulmocast file structure, tool results flow)
- Minimal new dependencies required
- Server-side storage allows direct mulmocast CLI usage
