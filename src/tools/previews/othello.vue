<template>
  <div class="p-3 bg-green-50 rounded">
    <div v-if="result.jsonData" class="space-y-1">
      <!-- Othello board display -->
      <div class="flex justify-center">
        <div
          class="inline-block"
          style="background-color: #2d5016; padding: 1px"
        >
          <div class="grid grid-cols-8" style="gap: 1px">
            <template
              v-for="(row, rowIndex) in result.jsonData.board"
              :key="rowIndex"
            >
              <div
                v-for="(cell, colIndex) in row"
                :key="`${rowIndex}-${colIndex}`"
                class="w-4 h-4 flex items-center justify-center"
                style="background-color: #3d6b20"
              >
                <div
                  v-if="cell === 'B'"
                  class="w-3 h-3 bg-black rounded-full"
                ></div>
                <div
                  v-else-if="cell === 'W'"
                  class="w-3 h-3 bg-white rounded-full"
                ></div>
              </div>
            </template>
          </div>
        </div>
      </div>
      <!-- Game info -->
      <div class="text-xs text-center space-y-1">
        <div v-if="!result.jsonData.isTerminal" class="text-gray-600">
          {{ result.jsonData.currentSide === "B" ? "⚫" : "⚪" }}
          {{
            capitalizeFirst(
              result.jsonData.playerNames[result.jsonData.currentSide],
            )
          }}
          to play
        </div>
        <div v-else class="font-medium">
          {{ getGameResult(result.jsonData) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { OthelloState } from "../logic/othelloLogic";

defineProps<{
  result: ToolResult<unknown, OthelloState>;
}>();

function getGameResult(gameState: any): string {
  if (!gameState.isTerminal) return "";
  if (gameState.winner === "draw") return "Draw!";
  if (gameState.winner === "B") return "⚫ Black Wins!";
  if (gameState.winner === "W") return "⚪ White Wins!";
  return "Game Over";
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
</script>
