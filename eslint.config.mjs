import next from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/*.test.js',
      '**/*.test.jsx',
    ],
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@next/next': next,
      'react-hooks': reactHooks,
    },
    rules: {
      ...next.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  // Vite-built packages (packages/studio, packages/Open-Poe-AI, packages/Vibe-Workflow)
  // These are not Next.js apps and can't import next/image.
  // Also suppress react-hooks/exhaustive-deps for submodules (external code).
  {
    files: [
      'packages/studio/src/**/*.jsx',
      'packages/Open-Poe-AI/**/*.js',
      'packages/Open-Poe-AI/**/*.jsx',
      'packages/Vibe-Workflow/**/*.js',
      'packages/Vibe-Workflow/**/*.jsx',
    ],
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];