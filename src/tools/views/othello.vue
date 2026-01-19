<template>
  <div class="w-full h-full flex flex-col items-center justify-center p-4">
    <div v-if="gameState" class="flex flex-col items-center">
      <!-- Turn indicator -->
      <div class="text-white text-lg font-bold mb-4 text-center">
        Current Turn: {{ currentPlayerName }} ({{ currentColorName }})
      </div>

      <!-- Game board -->
      <div
        class="grid grid-cols-8 gap-0.5 p-4 bg-green-800 rounded-lg border-2 border-green-900"
      >
        <div
          v-for="(cell, index) in flatBoard"
          :key="index"
          :class="getCellClass(cell, index)"
          @click="handleCellClick(index)"
          @mouseenter="handleCellHover(index, true)"
          @mouseleave="handleCellHover(index, false)"
        >
          <!-- Piece -->
          <div
            v-if="cell.piece"
            :class="getPieceClass(cell.piece)"
            class="w-10 h-10 rounded-full border-2 border-gray-600"
          ></div>

          <!-- Legal move indicator -->
          <div
            v-else-if="cell.isLegalMove && !isComputerTurn"
            class="w-10 h-10 flex items-center justify-center text-gray-300 text-sm font-bold"
          >
            {{ cell.label }}
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

watch(
  () => props.selectedResult,
  (newResult) => {
    if (newResult?.toolName === "playOthello" && newResult.jsonData) {
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
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cellValue = gameState.value.board[row][col];
      const isLegalMove = gameState.value.legalMoves?.some(
        (move: any) => move.row === row && move.col === col,
      );

      board.push({
        row,
        col,
        piece: cellValue !== "." ? cellValue : null,
        isLegalMove,
        label: isLegalMove ? String.fromCharCode(65 + col) + (row + 1) : "",
      });
    }
  }
  return board;
});

function getCellClass(cell: any, index: number) {
  const baseClasses =
    "w-12 h-12 flex items-center justify-center border border-green-900 bg-green-700";
  const hoverClasses =
    cell.isLegalMove && !isComputerTurn.value && hoveredCell.value === index
      ? "bg-green-600"
      : "";
  const cursorClasses =
    cell.isLegalMove && !isComputerTurn.value && !gameState.value?.isTerminal
      ? "cursor-pointer hover:bg-green-600"
      : "cursor-default";

  return `${baseClasses} ${hoverClasses} ${cursorClasses}`;
}

function getPieceClass(piece: string) {
  return piece === "B" ? "bg-black" : "bg-white";
}

function handleCellClick(index: number): void {
  if (!gameState.value || gameState.value.isTerminal || isComputerTurn.value)
    return;

  const cell = flatBoard.value[index];
  if (!cell.isLegalMove) return;

  const columnLetter = String.fromCharCode(65 + cell.col);
  const rowNumber = cell.row + 1;

  props.sendTextMessage(
    `I want to play at ${columnLetter}${rowNumber}, which is column=${cell.col}, row=${cell.row} `,
  );
}

function handleCellHover(index: number, isEntering: boolean): void {
  if (!gameState.value || gameState.value.isTerminal || isComputerTurn.value)
    return;

  const cell = flatBoard.value[index];
  if (!cell.isLegalMove) return;

  hoveredCell.value = isEntering ? index : null;
}
</script>
