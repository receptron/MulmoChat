<template>
  <div class="w-full h-full flex flex-col items-center justify-center p-4">
    <div v-if="gameState" class="flex flex-col items-center">
      <!-- Turn indicator and score -->
      <div class="text-white text-lg font-bold mb-2 text-center">
        Current Turn: {{ currentPlayerName }} ({{ currentColorName }})
      </div>
      <div class="text-white text-sm mb-4 text-center">
        Captured - Black: {{ gameState.capturedStones.B }}, White:
        {{ gameState.capturedStones.W }}
      </div>

      <!-- Game board -->
      <div
        class="relative p-4 bg-amber-100 rounded-lg border-2 border-amber-900"
      >
        <div
          class="grid gap-0"
          :style="{
            gridTemplateColumns: `repeat(9, 1fr)`,
            width: '432px',
            height: '432px',
          }"
        >
          <div
            v-for="(cell, index) in flatBoard"
            :key="index"
            :class="getCellClass(cell, index)"
            @click="handleCellClick(index)"
            @mouseenter="handleCellHover(index, true)"
            @mouseleave="handleCellHover(index, false)"
          >
            <!-- Grid lines -->
            <div class="absolute inset-0 pointer-events-none">
              <div
                v-if="cell.row < 8"
                class="absolute left-1/2 top-1/2 w-0.5 bg-black"
                style="height: 48px; transform: translateX(-50%)"
              ></div>
              <div
                v-if="cell.col < 8"
                class="absolute left-1/2 top-1/2 h-0.5 bg-black"
                style="width: 48px; transform: translateY(-50%)"
              ></div>
            </div>

            <!-- Star points (2-2, 2-6, 6-2, 6-6, 4-4) -->
            <div
              v-if="isStarPoint(cell.row, cell.col)"
              class="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div class="w-2 h-2 bg-black rounded-full"></div>
            </div>

            <!-- Piece -->
            <div
              v-if="cell.piece"
              :class="getPieceClass(cell.piece)"
              class="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div
                class="w-10 h-10 rounded-full border-2"
                :class="
                  cell.piece === 'B'
                    ? 'bg-black border-gray-700'
                    : 'bg-white border-gray-300'
                "
              ></div>
            </div>

            <!-- Legal move indicator (hover preview) -->
            <div
              v-else-if="!isComputerTurn && hoveredCell === index"
              class="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div
                class="w-10 h-10 rounded-full opacity-50"
                :class="gameState.currentSide === 'B' ? 'bg-black' : 'bg-white'"
              ></div>
            </div>
          </div>
        </div>

        <!-- Column labels -->
        <div class="absolute -bottom-6 left-4 right-4 flex justify-around">
          <div
            v-for="col in columnLabels"
            :key="col"
            class="text-xs font-bold text-white w-12 text-center"
          >
            {{ col }}
          </div>
        </div>

        <!-- Row labels -->
        <div
          class="absolute -left-6 top-4 bottom-4 flex flex-col justify-around"
        >
          <div
            v-for="row in 9"
            :key="row"
            class="text-xs font-bold text-white h-12 flex items-center justify-center"
          >
            {{ row }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";

const props = defineProps<{
  selectedResult: ToolResult | null;
  sendTextMessage: (text?: string) => void;
}>();

const gameState = ref<any>(null);
const hoveredCell = ref<number | null>(null);

// Column labels A-J (skipping I)
const columnLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "J"];

watch(
  () => props.selectedResult,
  (newResult) => {
    if (newResult?.toolName === "playGo" && newResult.jsonData) {
      gameState.value = newResult.jsonData;
    }
  },
  { immediate: true },
);

const currentPlayerName = computed(() => {
  if (!gameState.value?.playerNames) return "";
  const player = gameState.value.playerNames[gameState.value.currentSide];
  return player.charAt(0).toUpperCase() + player.slice(1);
});

const currentColorName = computed(() => {
  if (!gameState.value) return "";
  return gameState.value.currentSide === "B" ? "Black" : "White";
});

const isComputerTurn = computed(() => {
  return (
    gameState.value?.playerNames &&
    gameState.value.playerNames[gameState.value.currentSide] === "computer"
  );
});

const flatBoard = computed(() => {
  if (!gameState.value?.board) return [];

  const board = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cellValue = gameState.value.board[row][col];

      board.push({
        row,
        col,
        piece: cellValue !== "." ? cellValue : null,
      });
    }
  }
  return board;
});

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

function getCellClass(cell: any, index: number) {
  const baseClasses = "relative w-12 h-12";
  const cursorClasses =
    !cell.piece && !isComputerTurn.value && !gameState.value?.isTerminal
      ? "cursor-pointer"
      : "cursor-default";

  return `${baseClasses} ${cursorClasses}`;
}

function getPieceClass(piece: string) {
  return "";
}

function handleCellClick(index: number): void {
  if (!gameState.value || gameState.value.isTerminal || isComputerTurn.value)
    return;

  const cell = flatBoard.value[index];
  if (cell.piece) return; // Can't play on occupied intersection

  const columnLetter = columnLabels[cell.col];
  const rowNumber = cell.row + 1;

  props.sendTextMessage(
    `I want to play at ${columnLetter}${rowNumber}, which is column=${cell.col}, row=${cell.row}`,
  );
}

function handleCellHover(index: number, isEntering: boolean): void {
  if (!gameState.value || gameState.value.isTerminal || isComputerTurn.value)
    return;

  const cell = flatBoard.value[index];
  if (cell.piece) return;

  hoveredCell.value = isEntering ? index : null;
}
</script>
