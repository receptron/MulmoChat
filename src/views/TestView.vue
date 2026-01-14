<template>
  <div class="p-4 space-y-4 max-w-4xl mx-auto">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">Plugin Test</h1>
      <router-link
        to="/"
        class="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
      >
        Back to Home
      </router-link>
    </div>

    <!-- Plugin Selection -->
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        Select Plugin
      </label>
      <select
        v-model="selectedPluginName"
        class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">-- Select a plugin --</option>
        <option
          v-for="plugin in plugins"
          :key="plugin.toolDefinition.name"
          :value="plugin.toolDefinition.name"
        >
          {{ plugin.toolDefinition.name }}
        </option>
      </select>
    </div>

    <!-- Tool Definition Display -->
    <div v-if="selectedPlugin" class="space-y-4">
      <div class="bg-gray-50 p-4 rounded border border-gray-300">
        <h2 class="text-lg font-semibold mb-2">Tool Definition</h2>
        <div class="space-y-2 text-sm">
          <div>
            <span class="font-medium">Name:</span>
            {{ selectedPlugin.toolDefinition.name }}
          </div>
          <div>
            <span class="font-medium">Description:</span>
            {{ selectedPlugin.toolDefinition.description }}
          </div>
          <div v-if="selectedPlugin.toolDefinition.parameters">
            <span class="font-medium">Parameters:</span>
            <pre
              class="mt-1 p-2 bg-white rounded border border-gray-300 text-xs overflow-auto"
              >{{
                JSON.stringify(
                  selectedPlugin.toolDefinition.parameters,
                  null,
                  2,
                )
              }}</pre
            >
          </div>
        </div>
      </div>

      <!-- Sample Selection -->
      <div v-if="selectedPlugin.samples?.length" class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Sample Data
        </label>
        <select
          v-model="selectedSampleIndex"
          class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option :value="-1">-- Custom --</option>
          <option
            v-for="(sample, index) in selectedPlugin.samples"
            :key="index"
            :value="index"
          >
            {{ sample.name }}
          </option>
        </select>
      </div>

      <!-- Arguments Input -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          Arguments (JSON)
        </label>
        <textarea
          v-model="argsJson"
          class="w-full p-2 border border-gray-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows="6"
          placeholder='{"key": "value"}'
        ></textarea>
        <div v-if="argsError" class="text-red-500 text-sm">{{ argsError }}</div>
      </div>

      <!-- Execute Button -->
      <div class="flex gap-2">
        <button
          @click="executePlugin"
          :disabled="executing"
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ executing ? "Executing..." : "Execute" }}
        </button>
        <button
          @click="clearResult"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
        >
          Clear Result
        </button>
      </div>

      <!-- Result Display -->
      <div v-if="result" class="space-y-4">
        <div class="bg-green-50 p-4 rounded border border-green-200">
          <h2 class="text-lg font-semibold mb-2">Result</h2>
          <div class="space-y-2 text-sm">
            <div>
              <span class="font-medium">Tool Name:</span> {{ result.toolName }}
            </div>
            <div>
              <span class="font-medium">Message:</span> {{ result.message }}
            </div>
            <div v-if="result.title">
              <span class="font-medium">Title:</span> {{ result.title }}
            </div>
            <div v-if="result.data">
              <span class="font-medium">Data:</span>
              <pre
                class="mt-1 p-2 bg-white rounded border border-gray-300 text-xs overflow-auto max-h-60"
                >{{ JSON.stringify(result.data, null, 2) }}</pre
              >
            </div>
            <div v-if="result.jsonData">
              <span class="font-medium">JSON Data:</span>
              <pre
                class="mt-1 p-2 bg-white rounded border border-gray-300 text-xs overflow-auto max-h-60"
                >{{ JSON.stringify(result.jsonData, null, 2) }}</pre
              >
            </div>
          </div>
        </div>

        <!-- View Component -->
        <div
          v-if="selectedPlugin.viewComponent"
          class="border border-gray-300 rounded overflow-hidden"
          style="height: 500px"
        >
          <component
            :is="selectedPlugin.viewComponent"
            :key="result.uuid"
            :selected-result="result"
            :send-text-message="dummySendTextMessage"
            :google-map-key="null"
            :set-mute="dummySetMute"
            :plugin-configs="{}"
            @update-result="handleUpdateResult"
          />
        </div>
      </div>

      <!-- Error Display -->
      <div
        v-if="errorMessage"
        class="bg-red-50 p-4 rounded border border-red-200"
      >
        <h2 class="text-lg font-semibold mb-2 text-red-700">Error</h2>
        <pre class="text-sm text-red-600 whitespace-pre-wrap">{{
          errorMessage
        }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { getPluginList, toolExecute, getToolPlugin } from "../tools";
import type { ToolResultComplete, ToolPlugin } from "../tools";

const plugins = computed(() => {
  return getPluginList().map((p) => p.plugin);
});

const selectedPluginName = ref("");
const selectedSampleIndex = ref(-1);
const argsJson = ref("{}");
const argsError = ref("");
const executing = ref(false);
const result = ref<ToolResultComplete | null>(null);
const errorMessage = ref("");

const selectedPlugin = computed<ToolPlugin | null>(() => {
  if (!selectedPluginName.value) return null;
  return getToolPlugin(selectedPluginName.value);
});

// Generate default args based on parameters
function generateDefaultArgs(): Record<string, any> {
  if (!selectedPlugin.value?.toolDefinition.parameters) {
    return {};
  }

  const params = selectedPlugin.value.toolDefinition.parameters;
  const defaultArgs: Record<string, any> = {};

  for (const [key, schema] of Object.entries(params.properties || {})) {
    const s = schema as any;
    if (s.default !== undefined) {
      defaultArgs[key] = s.default;
    } else if (s.enum && Array.isArray(s.enum) && s.enum.length > 0) {
      // For enum types, use the first value as default
      defaultArgs[key] = s.enum[0];
    } else if (s.type === "string") {
      defaultArgs[key] = "";
    } else if (s.type === "number" || s.type === "integer") {
      defaultArgs[key] = 0;
    } else if (s.type === "boolean") {
      defaultArgs[key] = false;
    } else if (s.type === "array") {
      defaultArgs[key] = [];
    } else if (s.type === "object") {
      defaultArgs[key] = {};
    }
  }

  return defaultArgs;
}

watch(selectedPluginName, () => {
  result.value = null;
  errorMessage.value = "";
  argsError.value = "";

  // If plugin has samples, select the first one by default
  if (selectedPlugin.value?.samples?.length) {
    selectedSampleIndex.value = 0;
    // Always update argsJson directly (watch may not fire if index was already 0)
    argsJson.value = JSON.stringify(
      selectedPlugin.value.samples[0].args,
      null,
      2,
    );
  } else {
    selectedSampleIndex.value = -1;
    argsJson.value = JSON.stringify(generateDefaultArgs(), null, 2);
  }
});

// Update args when sample selection changes
watch(selectedSampleIndex, () => {
  if (
    selectedSampleIndex.value >= 0 &&
    selectedPlugin.value?.samples?.[selectedSampleIndex.value]
  ) {
    argsJson.value = JSON.stringify(
      selectedPlugin.value.samples[selectedSampleIndex.value].args,
      null,
      2,
    );
  } else {
    argsJson.value = JSON.stringify(generateDefaultArgs(), null, 2);
  }
});

async function executePlugin() {
  if (!selectedPluginName.value) return;

  let args: Record<string, any>;
  try {
    args = JSON.parse(argsJson.value);
    argsError.value = "";
  } catch (e) {
    argsError.value = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
    return;
  }

  executing.value = true;
  errorMessage.value = "";
  result.value = null;

  try {
    const context = {
      currentResult: null,
    };
    const res = await toolExecute(context, selectedPluginName.value, args);
    result.value = res;
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e);
  } finally {
    executing.value = false;
  }
}

function clearResult() {
  result.value = null;
  errorMessage.value = "";
}

function handleUpdateResult(updatedResult: ToolResultComplete) {
  result.value = updatedResult;
}

// Dummy functions for view components
function dummySendTextMessage(text: string) {
  console.log("dummySendTextMessage:", text);
}

function dummySetMute(muted: boolean) {
  console.log("dummySetMute:", muted);
}
</script>

<style scoped></style>
