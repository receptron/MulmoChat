import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  {
    files: ["{src,test,samles}/**/*.{js,ts,yaml,yml}"],
  },
  {
    ignores: ["lib"],
  },
  eslint.configs.recommended,
  sonarjs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/utils/markdown.ts', '**/composables/*.ts', '**/tools/pluginRuntime.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.node,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      indent: ["error", 2],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^__",
          varsIgnorePattern: "^__",
          caughtErrorsIgnorePattern: "^__",
        },
      ],
      "linebreak-style": ["error", "unix"],
      quotes: "error",
      "no-shadow": "error",
      "no-param-reassign": "error",
      "no-undef": "error",
      "prefer-const": "error",
      "no-return-assign": "error",
      "object-shorthand": "error",
      semi: ["error", "always"],
      "prettier/prettier": "error",
      "sonarjs/pseudo-random": "off",
      "sonarjs/todo-tag": "off",
      "sonarjs/no-commented-code": "off",
      "sonarjs/no-unused-vars": "error",
      "sonarjs/cognitive-complexity": "off",
      "no-console": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/redundant-type-aliases": "off",
      "sonarjs/x-powered-by": "error",
      "sonarjs/cors": "off",
      "sonarjs/no-empty-test-file": "error"
    },
    plugins: {
      prettier: prettierPlugin,
    },
  },
  {
    // `yarn start` runs the tsc output under plain Node ESM, which cannot resolve an extensionless relative import.
    files: ["server/**/*.ts"],
    ignores: ["server/tests/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration", "ImportExpression"].map((node) => ({
          selector: `${node}[source.value=/^\\.(?!.*\\.js$)/]`,
          message: "Relative imports in server/ must end in .js (dist/server runs under Node ESM).",
        })),
      ],
    },
  },
  eslintConfigPrettier,
];
