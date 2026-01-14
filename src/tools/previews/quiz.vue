<template>
  <div class="p-3 bg-blue-50 rounded">
    <div v-if="quizData" class="space-y-2">
      <!-- Quiz Title -->
      <div class="text-sm font-semibold text-gray-800 text-center">
        {{ quizData.title || "Quiz" }}
      </div>

      <!-- Question Count -->
      <div class="text-center">
        <div
          class="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full"
        >
          {{ quizData.questions.length }}
          {{ quizData.questions.length === 1 ? "Question" : "Questions" }}
        </div>
      </div>

      <!-- Mini Preview of First Question -->
      <div class="text-xs text-gray-600 line-clamp-2">
        {{ quizData.questions[0]?.question }}
      </div>

      <!-- Choice indicators -->
      <div class="flex justify-center gap-1">
        <div
          v-for="(_, index) in Math.min(
            quizData.questions[0]?.choices.length || 0,
            4,
          )"
          :key="index"
          class="w-2 h-2 bg-gray-400 rounded-full"
        ></div>
        <div
          v-if="(quizData.questions[0]?.choices.length || 0) > 4"
          class="text-xs text-gray-500"
        >
          +{{ quizData.questions[0].choices.length - 4 }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { QuizData } from "../models/quiz";

const props = defineProps<{
  result: ToolResult;
}>();

const quizData = computed(() => props.result.jsonData as QuizData | null);
</script>
