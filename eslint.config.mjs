import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/vite.config.ts", "**/vitest.config.ts", "**/tailwind.config.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  {
    files: ["**/vite.config.ts", "**/vitest.config.ts", "**/tailwind.config.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: null,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.node
      }
    }
  }
];
