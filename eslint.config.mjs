import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-config-prettier";

/**
 * Flat ESLint config.
 *
 * Notable: the `no-restricted-syntax` block scoped to `components/**` and
 * `app/**` fails the build on any hex / rgb( / hsl( colour literal — colours in
 * those layers must come only from theme tokens (CSS custom properties). This is
 * Amendment 1's enforcement and it is load-bearing, not advisory.
 */

const COLOUR_MESSAGE =
  "No colour literals (hex / rgb() / hsl()) in components/** or app/**. Colours must come from a theme token (a CSS custom property). See docs/context/design.md.";

const noColourLiterals = [
  {
    selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
    message: COLOUR_MESSAGE,
  },
  {
    selector: "Literal[value=/(?:rgb|hsl)a?\\(/i]",
    message: COLOUR_MESSAGE,
  },
  {
    selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
    message: COLOUR_MESSAGE,
  },
  {
    selector: "TemplateElement[value.raw=/(?:rgb|hsl)a?\\(/i]",
    message: COLOUR_MESSAGE,
  },
];

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "db/migrations/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    // Amendment 1: no colour literals in the presentation layers.
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...noColourLiterals],
    },
  },
  {
    // Test files and config may use Node globals / looser rules.
    files: ["**/*.test.{ts,tsx}", "**/*.config.{ts,mts,mjs}", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  prettier,
);
