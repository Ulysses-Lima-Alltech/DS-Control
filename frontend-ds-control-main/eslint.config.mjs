import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...compat.extends('prettier'),
  {
    rules: {
      'react-hooks/exhaustive-deps': 'off',
      'no-multiple-empty-lines': ['warn', { max: 1, maxEOF: 0 }],
      'no-trailing-spaces': 'warn',
      'eol-last': ['error', 'always'],
      'prefer-const': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      indent: 'off',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Relative imports are not allowed. Use @/ alias instead.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
