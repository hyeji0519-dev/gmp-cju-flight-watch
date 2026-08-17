import js from '@eslint/js';

export default [
  { ignores: ['node_modules/**', 'artifacts/**', '.state/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', fetch: 'readonly' }
    },
    rules: { 'no-console': 'off' }
  }
];
