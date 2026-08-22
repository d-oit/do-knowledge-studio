import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  plugins: {
    "react-hooks": reactHooks,
  },
  rules: {
    // Plan 131 G7 (governance decision 2026-08-22): re-enabled — the
    // codebase contains zero `any` usages, matching AGENTS.md.
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    "@typescript-eslint/no-require-imports": "off",

    // Plan 131 G7 (governance decision 2026-08-22): re-enabled to match
    // the AGENTS.md hard rules. React Compiler handles memoization, but
    // this rule still catches stale-closure bugs the compiler cannot.
    "react-hooks/exhaustive-deps": "error",
    // React Compiler diagnostics (plans/129): surface components the compiler
    // cannot auto-optimize. Zero findings today — keep them green.
    "react-hooks/purity": "warn",
    "react-hooks/use-memo": "warn",
    "react-hooks/immutability": "warn",
    "react-hooks/refs": "warn",
    "react-hooks/static-components": "warn",
    "react-hooks/set-state-in-effect": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    "prefer-const": "warn",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "error",
    "no-empty": "warn",
    "no-irregular-whitespace": "warn",
    "no-case-declarations": "off",
    "no-fallthrough": "warn",
    "no-mixed-spaces-and-tabs": "warn",
    "no-redeclare": "error",
    "no-undef": "off",
    "no-unreachable": "error",
    "no-useless-escape": "warn",
  },
}, {
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    ".agents/**",
    "next-env.d.ts",
    "examples/**",
    "skills",
  ]
}];

export default eslintConfig;
