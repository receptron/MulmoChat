<template>
  <div class="w-full h-full overflow-y-auto">
    <div class="min-h-full flex flex-col p-4">
      <div v-if="selectedResult.title" class="mb-4 text-center">
        <h2 class="text-2xl font-bold text-gray-900">
          {{ selectedResult.title }}
        </h2>
      </div>
      <div class="mb-4 flex gap-2 items-center justify-center">
        <button
          @click="isPlaying ? handleStop() : handlePlay()"
          :disabled="!isLoaded"
          class="px-4 py-2 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
          :class="isPlaying ? 'bg-red-500' : 'bg-blue-500'"
        >
          <span class="material-icons">{{
            isPlaying ? "stop" : "play_arrow"
          }}</span>
          {{ isPlaying ? "Stop" : "Play" }}
        </button>
        <label class="flex items-center gap-2">
          Tempo
          <input
            v-model.number="tempo"
            type="number"
            min="30"
            max="300"
            class="w-20 px-2 py-1 border border-gray-300 rounded"
          />
          bpm
        </label>
      </div>
      <div
        ref="musicContainer"
        class="flex-1 flex items-center justify-center bg-white rounded-lg p-4"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from "vue";
import type { ToolResult } from "../types";
import type { MusicToolData } from "../models/music";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
// @ts-ignore
import PlaybackEngine from "osmd-audio-player";

const props = defineProps<{
  selectedResult: ToolResult<MusicToolData>;
}>();

const musicContainer = ref<HTMLElement | null>(null);
let osmd: OpenSheetMusicDisplay | null = null;
let player: any = null;

const isLoaded = ref(false);
const isPlaying = ref(false);
const tempo = ref(200);
const loop = ref(false);
const metronome = ref(false);

const renderMusic = async () => {
  if (!musicContainer.value || !props.selectedResult.data?.musicXML) {
    return;
  }

  try {
    // Clear previous rendering
    musicContainer.value.innerHTML = "";
    isLoaded.value = false;
    isPlaying.value = false;

    // Create new OSMD instance
    osmd = new OpenSheetMusicDisplay(musicContainer.value, {
      autoResize: true,
      backend: "svg",
      drawTitle: false,
      followCursor: true,
    });

    // Load and render the MusicXML
    await osmd.load(props.selectedResult.data.musicXML);
    await osmd.render();

    // Initialize audio player
    if (!player) {
      player = new PlaybackEngine();
    }

    // Load score into audio player
    await player.loadScore(osmd);

    // Extract tempo from the score if available
    const scoreTempos = osmd.Sheet?.SourceMeasures?.[0]?.TempoExpressions;
    if (scoreTempos && scoreTempos.length > 0) {
      const firstTempo = scoreTempos[0];
      // @ts-ignore - OSMD tempo property access
      const tempoValue = firstTempo.TempoInBpm || firstTempo.tempoInBpm;
      if (tempoValue) {
        tempo.value = tempoValue;
      }
    }

    // Listen for iteration events (fires when playback completes)
    player.on("iteration", (data: any) => {
      // Check if we've reached the end and not looping
      if (!loop.value && data && data.length === 0) {
        player.stop();
        isPlaying.value = false;
      }
    });

    isLoaded.value = true;
  } catch (error) {
    console.error("Error rendering music:", error);
    if (musicContainer.value) {
      musicContainer.value.innerHTML = `<div class="text-red-500">Error rendering sheet music: ${error instanceof Error ? error.message : "Unknown error"}</div>`;
    }
  }
};

const handlePlay = async () => {
  if (!player || !isLoaded.value) return;

  player.setBpm(Math.max(30, Math.min(300, tempo.value)));
  player.metronomeVolume = metronome.value ? 0.7 : 0.0;
  player.isLooping = loop.value;

  await player.play();
  isPlaying.value = true;
};

const handlePause = () => {
  if (!player) return;
  player.pause();
  isPlaying.value = false;
};

const handleStop = () => {
  if (!player) return;
  player.stop();
  isPlaying.value = false;
};

watch(tempo, () => {
  if (player) {
    player.setBpm(Math.max(30, Math.min(300, tempo.value)));
  }
});

watch(loop, () => {
  if (player) {
    player.isLooping = loop.value;
  }
});

watch(metronome, () => {
  if (player) {
    player.metronomeVolume = metronome.value ? 0.7 : 0.0;
  }
});

onMounted(() => {
  renderMusic();
});

watch(
  () => props.selectedResult.data?.musicXML,
  () => {
    renderMusic();
  },
);

onUnmounted(() => {
  if (player) {
    player.stop();
  }
});
</script>
