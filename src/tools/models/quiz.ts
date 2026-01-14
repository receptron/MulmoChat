import { ToolPlugin, ToolContext, ToolResult } from "../types";
import QuizView from "../views/quiz.vue";
import QuizPreview from "../previews/quiz.vue";

const toolName = "putQuestions";

export interface QuizQuestion {
  question: string;
  choices: string[];
  correctAnswer?: number;
}

export interface QuizData {
  title?: string;
  questions: QuizQuestion[];
  userAnswers?: number[];
}

export type QuizResult = ToolResult<never, QuizData>;

export interface QuizArgs {
  title?: string;
  questions: QuizQuestion[];
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Present a set of multiple choice questions to test the user's knowledge or abilities. Each question should have 2-6 answer choices.",
  parameters: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description:
          "Optional title for the quiz (e.g., 'JavaScript Basics Quiz')",
      },
      questions: {
        type: "array",
        description: "Array of multiple choice questions",
        items: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The question text",
            },
            choices: {
              type: "array",
              description: "Array of answer choices (2-6 choices)",
              items: {
                type: "string",
              },
              minItems: 2,
              maxItems: 6,
            },
            correctAnswer: {
              type: "number",
              description:
                "Optional: The index of the correct answer (0-based). Include this if you want to track correct answers.",
            },
          },
          required: ["question", "choices"],
        },
        minItems: 1,
      },
    },
    required: ["questions"],
  },
};

const putQuestions = async (
  context: ToolContext,
  args: QuizArgs,
): Promise<QuizResult> => {
  try {
    const { title, questions } = args;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new Error("At least one question is required");
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || typeof q.question !== "string") {
        throw new Error(`Question ${i + 1} must have a question text`);
      }
      if (!Array.isArray(q.choices) || q.choices.length < 2) {
        throw new Error(`Question ${i + 1} must have at least 2 choices`);
      }
      if (q.choices.length > 6) {
        throw new Error(`Question ${i + 1} cannot have more than 6 choices`);
      }
    }

    const quizData: QuizData = {
      title,
      questions,
    };

    return {
      message: `Quiz presented with ${questions.length} question${questions.length > 1 ? "s" : ""}`,
      jsonData: quizData,
      instructions:
        "The quiz has been presented to the user. Wait for the user to submit their answers. They will tell you their answers in text format.",
    };
  } catch (error) {
    console.error("ERR: exception\n Quiz creation error", error);
    return {
      message: `Quiz error: ${error instanceof Error ? error.message : "Unknown error"}`,
      instructions:
        "Acknowledge that there was an error creating the quiz and suggest trying again.",
    };
  }
};

export const plugin: ToolPlugin<never, QuizData, QuizArgs> = {
  toolDefinition,
  execute: putQuestions,
  generatingMessage: "Preparing quiz...",
  isEnabled: () => true,
  viewComponent: QuizView,
  previewComponent: QuizPreview,
  samples: [
    {
      name: "Simple Quiz (2 questions)",
      args: {
        title: "Sample Quiz",
        questions: [
          {
            question: "What is the capital of Japan?",
            choices: ["Tokyo", "Osaka", "Kyoto", "Nagoya"],
            correctAnswer: 0,
          },
          {
            question: "Which planet is known as the Red Planet?",
            choices: ["Venus", "Mars", "Jupiter", "Saturn"],
            correctAnswer: 1,
          },
        ],
      },
    },
    {
      name: "Programming Quiz",
      args: {
        title: "JavaScript Basics",
        questions: [
          {
            question: "What does 'typeof null' return in JavaScript?",
            choices: ["null", "undefined", "object", "number"],
            correctAnswer: 2,
          },
          {
            question: "Which method adds an element to the end of an array?",
            choices: ["push()", "pop()", "shift()", "unshift()"],
            correctAnswer: 0,
          },
          {
            question: "What is the result of '1' + 2 in JavaScript?",
            choices: ["3", "12", "NaN", "undefined"],
            correctAnswer: 1,
          },
        ],
      },
    },
  ],
};
