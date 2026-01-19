<template>
  <div class="p-3 bg-amber-50 rounded">
    <div v-if="result.jsonData" class="space-y-1">
      <!-- Go board display -->
      <div class="flex justify-center">
        <div
          class="inline-block relative"
          style="background-color: #d4a574; padding: 4px"
        >
          <div class="grid grid-cols-9" style="gap: 0px">
            <template
              v-for="(row, rowIndex) in result.jsonData.board"
              :key="rowIndex"
            >
              <div
                v-for="(cell, colIndex) in row"
                :key="`${rowIndex}-${colIndex}`"
                class="w-3 h-3 flex items-center justify-center relative"
              >
                <!-- Grid lines -->
                <div
                  v-if="Number(rowIndex) < 8"
                  class="absolute left-1/2 top-1/2 w-px bg-black"
                  style="height: 12px; transform: translateX(-50%)"
                ></div>
                <div
                  v-if="Number(colIndex) < 8"
                  class="absolute left-1/2 top-1/2 h-px bg-black"
                  style="width: 12px; transform: translateY(-50%)"
                ></div>

                <!-- Star points -->
                <div
                  v-if="isStarPoint(Number(rowIndex), Number(colIndex))"
                  class="absolute w-1 h-1 bg-black rounded-full"
                  style="z-index: 1"
                ></div>

                <!-- Stones -->
                <div
                  v-if="cell === 'B'"
                  class="w-2.5 h-2.5 bg-black rounded-full relative"
                  style="z-index: 2"
                ></div>
                <div
                  v-else-if="cell === 'W'"
                  class="w-2.5 h-2.5 bg-white rounded-full border border-gray-300 relative"
                  style="z-index: 2"
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
        <div class="text-gray-500 text-xs">
          Captured: ⚫{{ result.jsonData.capturedStones.B }} ⚪{{
            result.jsonData.capturedStones.W
          }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "gui-chat-protocol/vue";
import type { GoState } from "../logic/goLogic";

defineProps<{
  result: ToolResult<unknown, GoState>;
}>();

function isStarPoint(row: number, col: number): boolean {
  const starPoints = [
    [2, 2],
    [2, 6],
    [4, 4],
    [6, 2],
    [6, 6],
  ];
  return starPoints.some(([r, c]) => r === row && c === col);
}

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
