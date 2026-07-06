import tsParser from "@typescript-eslint/parser";
import oxlint from "eslint-plugin-oxlint";
import tailwindcss from "eslint-plugin-tailwindcss";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    // ESLint の flat config は .gitignore を自動参照しないため、生成物は明示的に除外する
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.next/**",
      "**/.react-router/**",
      "**/.astro/**",
      "**/.wrangler/**",
      "**/worker-configuration.d.ts",
      "**/components/ui/**",
      "**/*.hbs",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    // apps/docs は Tailwind CSS (app/app.css) を使うため、Tailwind 固有ルールをこの範囲だけに絞る
    files: ["apps/docs/**/*.{ts,tsx}"],
    extends: [tailwindcss.configs.recommended],
    settings: {
      tailwindcss: {
        cssConfigPath: "./app/app.css",
      },
    },
  },
  ...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json"),
]);
