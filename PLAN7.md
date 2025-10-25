# PLAN7: Mode-Specific Plugin Availability

## Objective

Implement mode-specific plugin filtering where:
- **General mode**: Users can customize which plugins are enabled (current behavior)
- **All other modes**: Plugin list is fixed in mode configuration (not user-customizable)

Plugins remain completely agnostic to the mode system.

## Current Architecture Summary

- **Modes**: Defined in `src/config/systemPrompts.ts` (will be renamed to `src/config/modes.ts`) with 5 modes (general, tutor, listener, receptionist, game)
- **Plugins**: 22+ plugins registered in `src/tools/index.ts`
- **Current Filtering**: Two-level system
  1. Plugin's `isEnabled(startResponse)` method (server-level API checks)
  2. User preferences `enabledPlugins` record (UI-level user toggles)
- **Final Filter**: Plugin enabled if `(userEnabled ?? true) AND plugin.isEnabled()`

## Naming Changes

As part of this implementation, we'll rename configuration files and types to better reflect their purpose:
- **File**: `src/config/systemPrompts.ts` → `src/config/modes.ts`
- **Interface**: `SystemPrompt` → `Mode`
- **Constant**: `SYSTEM_PROMPTS` → `MODES`
- **Function**: `getSystemPrompt()` → `getMode()`
- **Variable**: `systemPromptId` → `modeId` (in useUserPreferences and throughout codebase)
- **LocalStorage key**: `system_prompt_id_v1` → `mode_id_v2` (with migration)

## Design Principles

1. **Zero Plugin Modification**: Plugins remain completely mode-agnostic
2. **Centralized Configuration**: Mode-plugin relationships defined only in mode configuration
3. **Simplified User Control**: Only general mode allows plugin customization; other modes have fixed sets
4. **Clear UI Feedback**: Plugin toggles only shown in general mode
5. **Backward Compatibility**: Existing localStorage preferences continue working for general mode

---

## Implementation Plan

**Important**: This implementation includes a significant refactoring to rename `systemPrompts` → `modes` throughout the codebase for better clarity. See the Refactoring Summary at the end for details.

### Phase 1: Rename and Update Configuration Structure

#### 1.0 Rename File and Types

**Action**: Rename file and update all type references
- Rename `src/config/systemPrompts.ts` → `src/config/modes.ts`
- Update all imports throughout the codebase
- Update references in:
  - `src/composables/useUserPreferences.ts`
  - `src/components/Sidebar.vue`
  - `src/App.vue`
  - Any other files importing from systemPrompts

#### 1.1 Define Mode Interface

**File**: `src/config/modes.ts` (renamed from systemPrompts.ts)

**Changes**:
```typescript
interface Mode {
  id: string;
  name: string;
  icon: string;
  includePluginPrompts: boolean;
  prompt: string;
  // NEW: Plugin availability configuration
  pluginMode: "customizable" | "fixed";
  availablePlugins?: string[];
  // - pluginMode: "customizable" = user can toggle plugins (general mode only)
  //   - availablePlugins should be undefined or "all" will be ignored
  // - pluginMode: "fixed" = fixed plugin set defined in availablePlugins
  //   - availablePlugins is the exact whitelist (required)
}
```

**Rationale**:
- `pluginMode: "customizable"` makes it explicit that only general mode allows customization
- `pluginMode: "fixed"` makes other modes' plugin lists immutable by users
- Clear distinction between modes that allow user control vs. modes with curated plugin sets

#### 1.2 Configure Each Mode

**File**: `src/config/modes.ts`

**Example Configuration**:
```typescript
const MODES: Mode[] = [
  {
    id: "general",
    name: "General",
    icon: "star",
    includePluginPrompts: true,
    pluginMode: "customizable",  // User can toggle plugins
    // availablePlugins not needed - all plugins available for toggling
    prompt: "..."
  },
  {
    id: "tutor",
    name: "Tutor",
    icon: "school",
    includePluginPrompts: true,
    pluginMode: "fixed",  // Fixed plugin set
    availablePlugins: [
      "quiz",
      "markdown",
      "generateImage",
      "browse",
      "exa",
      "canvas",
      "pdf",
      "textResponse",
      "switchMode"
    ],
    prompt: "..."
  },
  {
    id: "listener",
    name: "Listener",
    icon: "hearing",
    includePluginPrompts: false,
    pluginMode: "fixed",
    availablePlugins: [
      "generateImage",
      "editImage",
      "switchMode"
    ],
    prompt: "..."
  },
  {
    id: "receptionist",
    name: "Receptionist",
    icon: "badge",
    includePluginPrompts: true,
    pluginMode: "fixed",
    availablePlugins: [
      "form",
      "markdown",
      "textResponse",
      "switchMode"
    ],
    prompt: "..."
  },
  {
    id: "game",
    name: "Game",
    icon: "sports_esports",
    includePluginPrompts: true,
    pluginMode: "fixed",
    availablePlugins: [
      "othello",
      "go",
      "quiz",
      "generateHtml",
      "editHtml",
      "canvas",
      "textResponse",
      "switchMode"
    ],
    prompt: "..."
  }
];
```

**Notes**:
- Only `general` has `pluginMode: "customizable"`
- All other modes have `pluginMode: "fixed"` with explicit plugin lists
- `switchMode` included in most modes so users aren't trapped
- Each mode has carefully curated plugins for its specific use case

---

### Phase 2: Plugin Filtering Logic

#### 2.1 Add Mode-Based Filtering Function

**File**: `src/tools/index.ts`

**Add import**:
```typescript
import { getMode } from '@/config/modes';  // Import from renamed file
```

**New Helper Function**:
```typescript
/**
 * Gets the list of available plugins for a given mode
 * @param modeId - The current mode ID
 * @returns Array of plugin names available in this mode, or null if all plugins available
 */
export function getAvailablePluginsForMode(
  modeId: string
): string[] | null {
  const mode = getMode(modeId);

  // If mode not found, default to all available
  if (!mode) {
    return null;
  }

  // Customizable mode: all plugins available for user to choose
  if (mode.pluginMode === "customizable") {
    return null;
  }

  // Fixed mode: return the exact list
  if (mode.pluginMode === "fixed") {
    return mode.availablePlugins || [];
  }

  // Fallback: all available
  return null;
}

/**
 * Checks if a plugin is available in the given mode
 * @param pluginName - The name of the plugin
 * @param modeId - The current mode ID
 * @returns true if plugin is available in the mode
 */
export function isPluginAvailableInMode(
  pluginName: string,
  modeId: string
): boolean {
  const availablePlugins = getAvailablePluginsForMode(modeId);

  // null means all plugins available (customizable mode)
  if (availablePlugins === null) {
    return true;
  }

  // Check if plugin is in the fixed list
  return availablePlugins.includes(pluginName);
}

/**
 * Checks if the current mode allows user customization of plugins
 * @param modeId - The current mode ID
 * @returns true if user can toggle plugins in this mode
 */
export function isModeCustomizable(modeId: string): boolean {
  const mode = getMode(modeId);
  return mode?.pluginMode === "customizable";
}
```

#### 2.2 Update pluginTools() Filter

**File**: `src/tools/index.ts`

**Current**:
```typescript
export function pluginTools(
  startResponse?: StartChatResponse,
  enabledPlugins?: Record<string, boolean>
): ToolDefinition[] {
  return pluginList
    .filter(
      (toolName) =>
        (enabledPlugins?.[toolName] ?? true) &&
        plugins[toolName].isEnabled(startResponse)
    )
    .map((toolName) => plugins[toolName].toolDefinition);
}
```

**New** (add modeId parameter):
```typescript
export function pluginTools(
  startResponse?: StartChatResponse,
  enabledPlugins?: Record<string, boolean>,
  modeId?: string
): ToolDefinition[] {
  return pluginList
    .filter((toolName) => {
      // Server-level: Does plugin have required API credentials?
      if (!plugins[toolName].isEnabled(startResponse)) {
        return false;
      }

      // If no mode specified, default to enabled
      if (!modeId) {
        return enabledPlugins?.[toolName] ?? true;
      }

      // Mode-level filtering
      const availableInMode = isPluginAvailableInMode(toolName, modeId);
      if (!availableInMode) {
        return false;
      }

      // User-level: Only applies to customizable modes
      if (isModeCustomizable(modeId)) {
        return enabledPlugins?.[toolName] ?? true;
      }

      // Fixed mode: plugin is in the list, so it's enabled
      return true;
    })
    .map((toolName) => plugins[toolName].toolDefinition);
}
```

**Filtering Logic**:
1. **Server-level** (`plugin.isEnabled`): API credentials/features available
2. **Mode-level** (`isPluginAvailableInMode`): Plugin in mode's allowed list
3. **User-level** (`enabledPlugins`): Only for customizable modes (general)

#### 2.3 Update getPluginSystemPrompts()

**File**: `src/tools/index.ts`

**Update signature and filtering**:
```typescript
export function getPluginSystemPrompts(
  startResponse?: StartChatResponse,
  enabledPlugins?: Record<string, boolean>,
  modeId?: string
): string {
  return pluginList
    .filter((toolName) => {
      // Same filtering logic as pluginTools
      if (!plugins[toolName].isEnabled(startResponse)) {
        return false;
      }

      if (!modeId) {
        return enabledPlugins?.[toolName] ?? true;
      }

      const availableInMode = isPluginAvailableInMode(toolName, modeId);
      if (!availableInMode) {
        return false;
      }

      if (isModeCustomizable(modeId)) {
        return enabledPlugins?.[toolName] ?? true;
      }

      return true;
    })
    .map((toolName) => plugins[toolName].systemPrompt)
    .filter((prompt): prompt is string => !!prompt)
    .join("\n\n");
}
```

---

### Phase 3: Integration with Preferences

#### 3.1 Update buildTools()

**File**: `src/composables/useUserPreferences.ts`

**Current**:
```typescript
const buildTools = ({ startResponse }: { startResponse?: StartChatResponse }) => {
  return pluginTools(startResponse, state.enabledPlugins);
};
```

**New** (pass modeId):
```typescript
const buildTools = ({ startResponse }: { startResponse?: StartChatResponse }) => {
  return pluginTools(
    startResponse,
    state.enabledPlugins,
    state.modeId  // Renamed from systemPromptId
  );
};
```

#### 3.2 Update buildInstructions()

**File**: `src/composables/useUserPreferences.ts`

**Current**:
```typescript
const buildInstructions = ({ startResponse }: { startResponse?: StartChatResponse }) => {
  const systemPrompt = getSystemPrompt(state.systemPromptId);
  const parts = [systemPrompt.prompt];
  if (systemPrompt.includePluginPrompts) {
    const pluginSystemPrompts = getPluginSystemPrompts(startResponse, state.enabledPlugins);
    // ...
  }
  // ...
};
```

**New** (use getMode and pass modeId):
```typescript
const buildInstructions = ({ startResponse }: { startResponse?: StartChatResponse }) => {
  const mode = getMode(state.modeId);  // Renamed from getSystemPrompt/systemPromptId
  const parts = [mode.prompt];
  if (mode.includePluginPrompts) {
    const pluginSystemPrompts = getPluginSystemPrompts(
      startResponse,
      state.enabledPlugins,
      state.modeId  // NEW: Pass mode ID
    );
    // ...
  }
  // ...
};
```

#### 3.3 Update UserPreferencesState

**File**: `src/composables/useUserPreferences.ts`

**Rename field in state interface**:
```typescript
interface UserPreferencesState {
  userLanguage: string;
  suppressInstructions: boolean;
  modeId: string;  // Renamed from systemPromptId
  customInstructions: string;
  enabledPlugins: Record<string, boolean>;
  // ... other fields
}
```

#### 3.4 Update localStorage Key with Migration

**File**: `src/composables/useUserPreferences.ts`

**Add migration logic**:
```typescript
// Initialize state with migration from old key
const state = reactive<UserPreferencesState>({
  // ... other fields
  modeId: localStorage.getItem('mode_id_v2') ||
          localStorage.getItem('system_prompt_id_v1') ||  // Fallback to old key
          DEFAULT_MODE_ID,
  // ... other fields
});

// Watch for changes and persist to new key
watch(
  () => state.modeId,
  (newValue) => {
    localStorage.setItem('mode_id_v2', newValue);
    // Optionally clean up old key after migration
    if (localStorage.getItem('system_prompt_id_v1')) {
      localStorage.removeItem('system_prompt_id_v1');
    }
  }
);
```

---

### Phase 4: UI Updates

#### 4.1 Conditionally Show Plugin Toggles

**File**: `src/components/Sidebar.vue`

**Update Import**:
```typescript
import { getMode } from '@/config/modes';  // Updated from systemPrompts
import { isModeCustomizable } from '@/tools';
```

**Add Computed Property**:
```typescript
const isCurrentModeCustomizable = computed(() => {
  return isModeCustomizable(modeId.value);  // Renamed from systemPromptId
});
```

**Note**: Also update the prop/ref name from `systemPromptId` to `modeId` throughout Sidebar.vue

#### 4.2 Update Plugin Configuration UI

**File**: `src/components/Sidebar.vue`

**Current Plugin Toggle Section** (around lines 297-321):
```vue
<div class="plugins-config">
  <div class="section-title">Enabled Plugins</div>
  <div
    v-for="plugin in getPluginList()"
    :key="plugin.name"
    class="plugin-toggle"
  >
    <label>
      <input
        type="checkbox"
        :checked="enabledPlugins[plugin.name] ?? true"
        @change="handlePluginToggle(plugin.name, ($event.target as HTMLInputElement).checked)"
      />
      {{ plugin.toolDefinition.name }}
    </label>
  </div>
</div>
```

**New** (only show for customizable modes):
```vue
<div v-if="isCurrentModeCustomizable" class="plugins-config">
  <div class="section-title">Enabled Plugins</div>
  <div
    v-for="plugin in getPluginList()"
    :key="plugin.name"
    class="plugin-toggle"
  >
    <label>
      <input
        type="checkbox"
        :checked="enabledPlugins[plugin.name] ?? true"
        @change="handlePluginToggle(plugin.name, ($event.target as HTMLInputElement).checked)"
      />
      {{ plugin.toolDefinition.name }}
    </label>
  </div>
</div>

<!-- Optional: Show info for fixed modes -->
<div v-else class="plugins-info">
  <div class="section-title">Available Plugins</div>
  <div class="info-text">
    This mode uses a curated set of plugins optimized for its purpose.
    Switch to General mode to customize plugins.
  </div>
</div>
```

#### 4.3 Add CSS Styling (Optional)

**File**: `src/components/Sidebar.vue` (style section)

**New Styles**:
```css
.plugins-info {
  margin-top: 1em;
}

.plugins-info .info-text {
  font-size: 0.9em;
  color: #888;
  font-style: italic;
  padding: 0.5em;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
```

#### 4.4 Alternative: Show Plugin List (Read-Only)

**Alternative UI** (show which plugins are available but not toggleable):
```vue
<div v-if="isCurrentModeCustomizable" class="plugins-config">
  <!-- Toggleable checkboxes for general mode -->
  <div class="section-title">Enabled Plugins</div>
  <div
    v-for="plugin in getPluginList()"
    :key="plugin.name"
    class="plugin-toggle"
  >
    <label>
      <input
        type="checkbox"
        :checked="enabledPlugins[plugin.name] ?? true"
        @change="handlePluginToggle(plugin.name, ($event.target as HTMLInputElement).checked)"
      />
      {{ plugin.toolDefinition.name }}
    </label>
  </div>
</div>

<div v-else class="plugins-readonly">
  <div class="section-title">Available Plugins (Fixed)</div>
  <div class="readonly-plugin-list">
    <span
      v-for="plugin in getAvailablePluginsForCurrentMode()"
      :key="plugin.name"
      class="plugin-badge"
    >
      {{ plugin.toolDefinition.name }}
    </span>
  </div>
</div>
```

With helper:
```typescript
import { getAvailablePluginsForMode, getToolPlugin } from '@/tools';

const getAvailablePluginsForCurrentMode = () => {
  const pluginNames = getAvailablePluginsForMode(modeId.value);  // Renamed from systemPromptId
  if (!pluginNames) return getPluginList();
  return pluginNames.map(name => getToolPlugin(name)).filter(Boolean);
};
```

And CSS:
```css
.readonly-plugin-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
}

.plugin-badge {
  display: inline-block;
  padding: 0.25em 0.75em;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-size: 0.85em;
}
```

---

### Phase 5: Export Updates

#### 5.1 Export New Functions

**File**: `src/tools/index.ts`

Ensure these are exported:
```typescript
export {
  // ... existing exports
  isPluginAvailableInMode,
  getAvailablePluginsForMode,
  isModeCustomizable
};
```

#### 5.2 Export Helper from modes.ts

**File**: `src/config/modes.ts`

Ensure `getMode` is exported:
```typescript
export function getMode(id: string): Mode {
  return MODES.find(mode => mode.id === id) || MODES[0];
}

// Also export the constant and default
export const DEFAULT_MODE_ID = "general";
export { MODES };
```

---

### Phase 6: Testing & Validation

#### 6.1 Manual Test Cases

**Test 1: General Mode - User Customization Works**
1. Start in "General" mode
2. Open configuration popup
3. Verify plugin toggles are visible
4. Disable a plugin (e.g., "othello")
5. Verify plugin is removed from tool list
6. Re-enable the plugin
7. Verify plugin appears in tool list again

**Test 2: Fixed Mode - No User Customization**
1. Switch to "Listener" mode
2. Open configuration popup
3. Verify plugin toggles are hidden (or read-only info shown)
4. Verify only `generateImage`, `editImage`, `switchMode` available in session
5. Check that previous general mode preferences don't affect listener mode

**Test 3: Mode Switching Updates Available Plugins**
1. Start in "General" mode with "music" enabled
2. Switch to "Game" mode
3. Verify "music" is not available (not in game's plugin list)
4. Switch back to "General" mode
5. Verify "music" is available again (user preference preserved)

**Test 4: Fixed Mode Plugin List is Immutable**
1. Set mode to "Tutor"
2. Verify only tutor-specific plugins available
3. Check that localStorage `enabledPlugins` doesn't affect tutor mode
4. Tutor mode should always use exact plugin list from config

**Test 5: Backward Compatibility**
1. Clear localStorage
2. Load app in "General" mode
3. Verify all plugins default to enabled
4. Toggle some plugins off
5. Refresh page
6. Verify toggles are preserved

**Test 6: switchMode Plugin Always Available**
1. Start in any fixed mode (e.g., "Receptionist")
2. Verify `switchMode` plugin is in the tool list
3. Use switchMode to change to another mode
4. Verify mode switch succeeds

#### 6.2 Code Validation

**Checklist**:
- [ ] No plugin files modified (plugins remain mode-agnostic)
- [ ] All mode definitions have `pluginMode` field configured
- [ ] Only "general" has `pluginMode: "customizable"`
- [ ] All other modes have `pluginMode: "fixed"` with `availablePlugins` array
- [ ] `pluginTools()` applies correct filtering based on mode type
- [ ] `getPluginSystemPrompts()` applies same filtering
- [ ] UI hides plugin toggles for fixed modes
- [ ] localStorage preferences only affect general mode
- [ ] Mode switching updates plugin availability correctly

---

## Implementation Order

### Phase A: Refactoring (Rename systemPrompts → modes)
1. **Step 1**: Rename file `src/config/systemPrompts.ts` → `src/config/modes.ts`
2. **Step 2**: Rename interface `SystemPrompt` → `Mode`, constant `SYSTEM_PROMPTS` → `MODES`
3. **Step 3**: Rename function `getSystemPrompt()` → `getMode()`
4. **Step 4**: Update all imports in:
   - `src/composables/useUserPreferences.ts`
   - `src/components/Sidebar.vue`
   - `src/App.vue`
   - Any other files importing from systemPrompts
5. **Step 5**: Rename `systemPromptId` → `modeId` throughout codebase
6. **Step 6**: Add localStorage migration from `system_prompt_id_v1` → `mode_id_v2`
7. **Step 7**: Test that existing functionality still works after refactoring

### Phase B: Add Mode-Specific Plugin Features
8. **Step 8**: Add `pluginMode` field to `Mode` interface
9. **Step 9**: Configure all 5 modes with appropriate `pluginMode` values and `availablePlugins`
10. **Step 10**: Implement helper functions in `src/tools/index.ts`:
    - `getAvailablePluginsForMode()`
    - `isPluginAvailableInMode()`
    - `isModeCustomizable()`
11. **Step 11**: Update `pluginTools()` filtering logic with mode-based filtering
12. **Step 12**: Update `getPluginSystemPrompts()` filtering logic
13. **Step 13**: Update `getPluginsWithConfig()` filtering logic
14. **Step 14**: Update `useUserPreferences.buildTools()` to pass `modeId`
15. **Step 15**: Update `useUserPreferences.buildInstructions()` to pass `modeId`
16. **Step 16**: Add `isModeCustomizable` import and computed in Sidebar
17. **Step 17**: Update Sidebar template to conditionally show plugin toggles
18. **Step 18**: Add optional info/read-only display for fixed modes
19. **Step 19**: Test all scenarios (mode switching, plugin filtering, UI display)

---

## Edge Cases & Considerations

### 1. switchMode Plugin Availability
**Issue**: If `switchMode` is not in a fixed mode's list, user gets stuck

**Solution**:
- Include `switchMode` in all fixed mode plugin lists (recommended)
- Document that fixed modes should include `switchMode` unless intentionally locking the mode

### 2. Migrating Existing User Preferences
**Issue**: User has `enabledPlugins` stored; what happens in fixed modes?

**Solution**:
- No migration needed
- User preferences only affect general mode
- Fixed modes ignore user preferences entirely
- When user switches back to general, their preferences are restored

### 3. Plugin Config UI
**Issue**: Should plugin-specific config sections show for unavailable plugins?

**Solution** (update `getPluginsWithConfig()`):
```typescript
export function getPluginsWithConfig(
  modeId?: string
): ToolPlugin[] {
  return pluginList
    .filter(name => {
      if (!plugins[name].config) return false;
      if (!modeId) return true;
      return isPluginAvailableInMode(name, modeId);
    })
    .map(name => plugins[name]);
}
```
Update Sidebar to pass modeId:
```typescript
const pluginsWithConfig = getPluginsWithConfig(modeId.value);
```

### 4. Server-Level Plugin Disabling
**Issue**: What if a fixed mode requires a plugin but API credentials are missing?

**Solution**:
- Server-level check (`plugin.isEnabled(startResponse)`) still applies
- Plugin won't be available even in fixed mode if credentials missing
- Consider showing a warning in UI for fixed modes if required plugin is unavailable

### 5. Default Mode on First Load
**Issue**: Which mode should be default for new users?

**Solution**:
- Keep current behavior: defaults to "general"
- General mode is most flexible (customizable plugins)
- User can explore and then switch to specialized modes

---

## Benefits of This Approach

1. **Simplicity**: Clear distinction - general is customizable, others are fixed
2. **User-Friendly**: Advanced users can customize general mode; others use curated modes
3. **Clean UI**: Plugin toggles only shown when relevant (general mode)
4. **Plugin Agnostic**: Zero plugin code changes
5. **Maintainable**: Each mode's plugin list is explicitly configured
6. **Predictable**: Fixed modes always have the same plugins (no user confusion)
7. **Flexible**: General mode preserves current customization capability
8. **Backward Compatible**: Existing general mode users see no change

---

## Comparison: Customizable vs Fixed Modes

| Aspect | General (Customizable) | Other Modes (Fixed) |
|--------|----------------------|---------------------|
| Plugin Selection | User toggles via UI | Defined in config |
| `enabledPlugins` Preference | Respected | Ignored |
| UI Plugin Toggles | Visible | Hidden |
| Plugin List | All plugins (filterable) | Curated subset |
| Use Case | Exploration, flexibility | Focused, optimized |

---

## Files Modified Summary

| File | Changes | Type |
|------|---------|------|
| `src/config/systemPrompts.ts` → `src/config/modes.ts` | **Rename file**, rename interface to `Mode`, rename constant to `MODES`, rename function to `getMode()`, add `pluginMode` field | Config |
| `src/tools/index.ts` | Add helper functions (`getAvailablePluginsForMode`, `isPluginAvailableInMode`, `isModeCustomizable`), update `pluginTools()`, update `getPluginSystemPrompts()`, update `getPluginsWithConfig()` | Logic |
| `src/composables/useUserPreferences.ts` | **Rename field** `systemPromptId` → `modeId`, update imports, pass `modeId` to plugin filtering functions, migrate localStorage key | Integration |
| `src/components/Sidebar.vue` | **Rename prop/ref** `systemPromptId` → `modeId`, update imports, conditionally show plugin toggles, add read-only display | UI |
| `src/App.vue` | Update imports from `@/config/modes`, rename `systemPromptId` references to `modeId` | Integration |

**Files NOT Modified**:
- All plugin files in `src/tools/` subdirectories (plugins remain mode-agnostic ✓)
- `server/*` (no server changes needed)

---

## Example: Adding a New "Podcast" Mode (Fixed)

```typescript
// In modes.ts
{
  id: "podcast",
  name: "Podcast Creator",
  icon: "podcast",
  includePluginPrompts: true,
  pluginMode: "fixed",  // Users cannot customize
  availablePlugins: [
    "mulmocast",      // Podcast generation
    "music",          // Background music
    "browse",         // Research topics
    "exa",            // Find sources
    "markdown",       // Show notes
    "generateImage",  // Cover art
    "textResponse",   // Utility
    "switchMode"      // Allow mode switching
  ],
  prompt: `You are a podcast creation assistant...`
}
```

That's it! The system automatically:
- Hides plugin toggles in UI for podcast mode
- Uses exactly the 8 plugins listed
- Ignores user's `enabledPlugins` preferences
- Shows fixed plugin list (optional in UI)

---

## Example: User Workflow

**Scenario**: User wants to create educational content

1. **Exploration** (General Mode):
   - User starts in general mode
   - Enables/disables plugins to understand capabilities
   - Experiments with different tools

2. **Focused Work** (Tutor Mode):
   - User switches to tutor mode
   - Gets curated set: quiz, markdown, generateImage, browse, etc.
   - No distraction from irrelevant plugins (music, games, etc.)
   - Consistent experience optimized for tutoring

3. **Back to Exploration** (General Mode):
   - User switches back to general
   - Previous plugin preferences restored
   - Can customize again

---

## Conclusion

This plan implements mode-specific plugin availability with:
- ✅ Zero plugin modifications (plugins remain mode-agnostic)
- ✅ Centralized configuration (all in `modes.ts`)
- ✅ Clear two-tier system: customizable (general) vs fixed (others)
- ✅ Clean UI: plugin toggles only for general mode
- ✅ Backward compatible: general mode works as before, localStorage migrated
- ✅ Easy to extend: add fixed mode = add config with plugin list
- ✅ Predictable: fixed modes always have same curated plugins
- ✅ Better naming: "Mode" clearly represents the concept vs "SystemPrompt"

The implementation follows Vue 3 best practices and maintains clean separation of concerns.

## Refactoring Summary

This plan includes a significant refactoring to improve code clarity:
- **File rename**: `systemPrompts.ts` → `modes.ts`
- **Type rename**: `SystemPrompt` → `Mode`
- **Variable rename**: `systemPromptId` → `modeId` throughout codebase
- **Function rename**: `getSystemPrompt()` → `getMode()`
- **localStorage migration**: `system_prompt_id_v1` → `mode_id_v2` with automatic migration

These naming changes make the codebase more intuitive and accurately reflect that these are chat modes with configurations, not just system prompts.
