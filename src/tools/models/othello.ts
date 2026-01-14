import { ToolPlugin, ToolContext, ToolResult } from "../types";
import {
  playOthello,
  Command,
  Side,
  OthelloState,
} from "../logic/othelloLogic";
import OthelloView from "../views/othello.vue";
import OthelloPreview from "../previews/othello.vue";

const toolName = "playOthello";

export type OthelloResult = ToolResult<never, OthelloState>;

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Play Othello/Reversi game with the user. You can start a new game, make moves, or pass turns.",
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
          "Column position for the move (0-7, required for 'move' action). The user will tell you the column by specifying A to H",
        minimum: 0,
        maximum: 7,
      },
      row: {
        type: "number",
        description:
          "Row position for the move (0-7, required for 'move' action). The user will tell you the row by specifying 1 to 8",
        minimum: 0,
        maximum: 7,
      },
      board: {
        type: "array",
        description:
          "Current 8x8 board state BEFORE the move (required for 'move' and 'pass' actions). IMPORTANT: Do NOT modify the board yourself - pass the current board state as-is, and the game logic will handle placing the piece and flipping opponent pieces.",
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

const othello = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<OthelloResult> => {
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
        !args.playerNames
      ) {
        throw new Error(
          "Move action requires row, col, board, currentSide, and playerNames parameters",
        );
      }
      command = {
        action: "move",
        row: args.row,
        col: args.col,
        board: args.board,
        currentSide: args.currentSide as Side,
        playerNames: args.playerNames,
      };
    } else if (args.action === "pass") {
      if (!args.board || !args.currentSide || !args.playerNames) {
        throw new Error(
          "Pass action requires board, currentSide, and playerNames parameters",
        );
      }
      command = {
        action: "pass",
        board: args.board,
        currentSide: args.currentSide as Side,
        playerNames: args.playerNames,
      };
    } else {
      throw new Error(`Unknown action: ${args.action}`);
    }

    const state = playOthello(command);

    // Handle invalid move
    if (state.error) {
      const isComputerTurn =
        state.playerNames[state.currentSide] === "computer";
      const legalMovesStr = state.legalMoves
        .map((m) => `(${m.row}, ${m.col})`)
        .join(", ");

      const instructions = isComputerTurn
        ? `Invalid move attempted. You must make a valid move. Legal moves are: ${legalMovesStr}. Choose one of these moves.`
        : `Invalid move attempted. Tell the user they must make a valid move. Legal moves are: ${legalMovesStr}. The user will tell you the move by specifying column (A to H) and row (1 to 8).`;

      return {
        message: state.error,
        jsonData: state,
        instructions,
        updating: true,
      };
    }

    let message = "";
    if (state.lastAction.type === "new_game") {
      message = "Started a new Othello game! Black (●) goes first.";
    } else if (state.lastAction.type === "move") {
      message = `Played at (${state.lastAction.row}, ${state.lastAction.col}) and flipped ${state.lastAction.flipped} pieces.`;
    } else if (state.lastAction.type === "pass") {
      message = "Passed the turn.";
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
      ? "The game is over. Announce the game result."
      : isComputerTurn
        ? "The game state has been updated. Do not describe the state of the game. It is assistant's turn. You MUSK choose your next move."
        : "The game state has been updated. Tell the user to make a move. Do not describe the state of the game. The user is able to see it. The user will tell you the move by specifying colum (A to H) and row (1 to 8)";

    return {
      message,
      jsonData: state,
      instructions,
      instructionsRequired: state.isTerminal || isComputerTurn,
      updating: args.action !== "new_game",
    };
  } catch (error) {
    console.error("ERR: exception\n Othello game error", error);
    return {
      message: `Othello game error: ${error instanceof Error ? error.message : "Unknown error"}`,
      instructions:
        "Acknowledge that there was an error with the Othello game and suggest trying again.",
    };
  }
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: othello,
  generatingMessage: "Processing Othello move...",
  isEnabled: () => true,
  viewComponent: OthelloView,
  previewComponent: OthelloPreview,
  samples: [
    {
      name: "New Game (User First)",
      args: {
        action: "new_game",
        firstPlayer: "user",
      },
    },
    {
      name: "New Game (Computer First)",
      args: {
        action: "new_game",
        firstPlayer: "computer",
      },
    },
  ],
};
