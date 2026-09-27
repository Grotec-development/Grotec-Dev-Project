// Workspace-wide lint gate: `npm run lint` from the repo root.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'frontend/android/**',
      'frontend/ios/**',
      'output/**',
      'infrastructure/**',
      '**/*.d.ts',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  // Backend + shared: ES modules on Node (sources are compiled-TypeScript style JS)
  {
    files: ['backend/**/*.js', 'packages/shared/**/*.js'],
    extends: [js.configs.recommended],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // These packages are ESM: a CommonJS require() breaks at runtime
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='require']", message: 'Use an ES import; this package is an ES module.' },
      ],
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-empty': 'off',
      // TypeScript-emit helpers (`var _a, _b` placeholders, `if (d = decorators[i])`) trip these
      'no-var': 'off',
      'no-redeclare': 'off',
      'no-cond-assign': 'off',
    },
  },
  {
    files: ['**/*.spec.js', '**/*.e2e-spec.js', 'backend/test/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  // Frontend: React + TypeScript
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
