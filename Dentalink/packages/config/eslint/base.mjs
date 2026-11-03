import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
      "scratch/**",
      "scripts/publish-release.cjs",
      "scripts/maintenance/archive/**",
      "apps/api/test-*",
      "apps/web/scan_*.js",
      "packages/database/test.*",
      "packages/database/seed-templates.js",
      "test-*",
      "package-lock.json"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["**/*.{cjs,js}", "scripts/**/*.cjs"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        module: "readonly",
        require: "readonly",
        process: "readonly",
        console: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  }
);
