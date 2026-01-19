import type { ToolContext, ToolResult } from "gui-chat-protocol/vue";
import type { ToolPlugin } from "../types";
import { playGo, Command, Side, GoState } from "../logic/goLogic";
import GoView from "../views/go.vue";
import GoPreview from "../previews/go.vue";

const toolName = "playGo";

export type GoResult = ToolResult<never, GoState>;

export type GoCellValue = "." | "B" | "W";
export type GoPlayerType = "user" | "computer";

export interface GoArgs {
  action: "new_game" | "move" | "pass";
  col?: number;
  row?: number;
  board?: GoCellValue[][];
  currentSide?: Side;
  playerNames?: { B: GoPlayerType; W: GoPlayerType };
  capturedStones?: { B: number; W: number };
  consecutivePasses?: number;
  firstPlayer?: GoPlayerType;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Play the game of Go (Baduk/Weiqi) with the user on a 9x9 board. You can start a new game, make moves, or pass turns. The game ends after two consecutive passes.",
  parameters: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["new_game", "move", "pass"],
        description:
          "The action to perform: start a new game, make a move, or pass the turn",
      },
      col: {
        type: "number",
        description:
          "Column position for the move (0-8, required for 'move' action). The user will tell you the column by specifying A to J (skipping I)",
        minimum: 0,
        maximum: 8,
      },
      row: {
        type: "number",
        description:
          "Row position for the move (0-8, required for 'move' action). The user will tell you the row by specifying 1 to 9",
        minimum: 0,
        maximum: 8,
      },
      board: {
        type: "array",
        description:
          "Current 9x9 board state (required for 'move' and 'pass' actions)",
        items: {
          type: "array",
          items: {
            type: "string",
            enum: [".", "B", "W"],
          },
        },
      },
      currentSide: {
        type: "string",
        enum: ["B", "W"],
        description:
          "Current player's side (required for 'move' and 'pass' actions)",
      },
      playerNames: {
        type: "object",
        description:
          "Player assignments (required for 'move' and 'pass' actions)",
        properties: {
          B: {
            type: "string",
            enum: ["user", "computer"],
          },
          W: {
            type: "string",
            enum: ["user", "computer"],
          },
        },
        required: ["B", "W"],
      },
      capturedStones: {
        type: "object",
        description:
          "Count of captured stones for each player (required for 'move' and 'pass' actions)",
        properties: {
          B: {
            type: "number",
            description: "Number of stones captured by Black",
          },
          W: {
            type: "number",
            description: "Number of stones captured by White",
          },
        },
        required: ["B", "W"],
      },
      consecutivePasses: {
        type: "number",
        description:
          "Number of consecutive passes (required for 'pass' action, 0-2)",
        minimum: 0,
        maximum: 2,
      },
      firstPlayer: {
        type: "string",
        enum: ["user", "computer"],
        description:
          "Optional: Which player should play as Black (goes first) for 'new_game' action. If not specified, will be chosen randomly.",
      },
    },
    required: ["action"],
    additionalProperties: false,
  },
};

const go = async (context: ToolContext, args: GoArgs): Promise<GoResult> => {
  try {
    let command: Command;

    if (args.action === "new_game") {
      let blackPlayer: string;
      if (args.firstPlayer) {
        blackPlayer = args.firstPlayer;
      } else {
        blackPlayer = Math.random() < 0.5 ? "computer" : "user";
      }
      const whitePlayer = blackPlayer === "user" ? "computer" : "user";

      command = {
        action: "new_game",
        playerNames: { B: blackPlayer, W: whitePlayer },
      };
    } else if (args.action === "move") {
      if (
        typeof args.row !== "number" ||
        typeof args.col !== "number" ||
        !args.board ||
        !args.currentSide ||
        !args.playerNames ||
        !args.capturedStones
      ) {
        throw new Error(
          "Move action requires row, col, board, currentSide, playerNames, and capturedStones parameters",
        );
      }
      command = {
        action: "move",
        row: args.row,
        col: args.col,
        board: args.board,
        currentSide: args.currentSide as Side,
        playerNames: args.playerNames,
        capturedStones: args.capturedStones,
      };
    } else if (args.action === "pass") {
      if (
        !args.board ||
        !args.currentSide ||
        !args.playerNames ||
        !args.capturedStones ||
        typeof args.consecutivePasses !== "number"
      ) {
        throw new Error(
          "Pass action requires board, currentSide, playerNames, capturedStones, and consecutivePasses parameters",
        );
      }
      command = {
        action: "pass",
        board: args.board,
        currentSide: args.currentSide as Side,
        playerNames: args.playerNames,
        capturedStones: args.capturedStones,
        consecutivePasses: args.consecutivePasses,
      };
    } else {
      throw new Error(`Unknown action: ${args.action}`);
    }

    const state = playGo(command);

    // Handle invalid move
    if (state.error) {
      const isComputerTurn =
        state.playerNames[state.currentSide] === "computer";

      const instructions = isComputerTurn
        ? `Invalid move attempted. You must make a valid move. Choose an empty intersection where placing a stone would not result in immediate capture (suicide rule).`
        : `Invalid move attempted. Tell the user they must make a valid move. The position must be empty and the move must not be suicide. The user will tell you the move by specifying column (A to J, skipping I) and row (1 to 9).`;

      return {
        message: state.error,
        jsonData: state,
        instructions,
        updating: true,
      };
    }

    let message = "";
    if (state.lastAction.type === "new_game") {
      message = "Started a new Go game on a 9x9 board! Black (●) goes first.";
    } else if (state.lastAction.type === "move") {
      const captureMsg =
        state.lastAction.captured > 0
          ? ` and captured ${state.lastAction.captured} stone${state.lastAction.captured > 1 ? "s" : ""}`
          : "";
      message = `Played at (${state.lastAction.row}, ${state.lastAction.col})${captureMsg}.`;
    } else if (state.lastAction.type === "pass") {
      message = "Passed the turn.";
      if (state.consecutivePasses === 1) {
        message += " One more pass will end the game.";
      }
    }

    if (state.isTerminal) {
      if (state.winner === "draw") {
        message += " Game over - it's a draw!";
      } else if (state.winner) {
        message += ` Game over - ${state.winner === "B" ? "Black" : "White"} wins!`;
      }
    }

    const isComputerTurn = state.playerNames[state.currentSide] === "computer";
    const instructions = state.isTerminal
      ? "The game is over. Announce the game result with final scores."
      : isComputerTurn
        ? "The game state has been updated. It is your turn (you = AI assistant, computer). Make your move or pass."
        : "The game state has been updated. Tell the user to make a move or pass. Do not describe the state of the game. The user is able to see it. The user will tell you the move by specifying column (A to J, skipping I) and row (1 to 9).";

    return {
      message,
      jsonData: state,
      instructions,
      instructionsRequired: state.isTerminal || isComputerTurn,
      updating: args.action !== "new_game",
    };
  } catch (error) {
    console.error("ERR: exception\n Go game error", error);
    return {
      message: `Go game error: ${error instanceof Error ? error.message : "Unknown error"}`,
      instructions:
        "Acknowledge that there was an error with the Go game and suggest trying again.",
    };
  }
};

export const plugin: ToolPlugin<never, GoState, GoArgs> = {
  toolDefinition,
  execute: go,
  generatingMessage: "Processing Go move...",
  isEnabled: () => true,
  viewComponent: GoView,
  previewComponent: GoPreview,
};
