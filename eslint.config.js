import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import * as react from 'eslint-plugin-react';
import * as jsxA11y from 'eslint-plugin-jsx-a11y';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: [
      'dist',
      'node_modules',
      'playwright-report',
      'test-results',
      '.agents',
      'cli',
      '*.cjs',
      '*.config.*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Note: recommendedTypeChecked requires tsconfig project - disabled for now to avoid parsing issues
  // ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react': react,
      'jsx-a11y': jsxA11y,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'error',
      'no-empty-function': 'off', // Replaced by TS version
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
