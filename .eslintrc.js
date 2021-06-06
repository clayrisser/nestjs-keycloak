const fs = require('fs');

const cspell = JSON.parse(fs.readFileSync('.vscode/settings.json').toString())[
  'cSpell.words'
];

module.exports = {
  extends: ['airbnb-typescript/base', 'prettier'],
  parser: '@typescript-eslint/parser',
  root: true,
  env: {
    browser: true
  },
  plugins: ['spellcheck'],
  parserOptions: {
    project: './tsconfig.json',
    ecmaFeatures: {
      legacyDecorators: true
    }
  },
  rules: {
    '@typescript-eslint/comma-dangle': ['error', 'never'],
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/no-shadow': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'arrow-body-style': 'off',
    'class-methods-use-this': 'off',
    'comma-dangle': 'off',
    'default-case': 'off',
    'import/extensions': ['error', 'never', { json: 'always' }],
    'import/no-cycle': 'off',
    'import/prefer-default-export': 'off',
    'max-classes-per-file': 'off',
    'max-lines': ['error', 500],
    'max-lines-per-function': ['warn', 50],
    'no-await-in-loop': 'off',
    'no-empty-function': ['warn', { allow: ['constructors'] }],
    'no-extra-boolean-cast': 'off',
    'no-param-reassign': 'off',
    'no-plusplus': 'off',
    'no-return-assign': 'off',
    'no-shadow': 'off',
    'no-underscore-dangle': 'off',
    'no-use-before-define': 'off',
    'no-useless-constructor': 'off',
    'react/jsx-props-no-spreading': 'off',
    yoda: 'off',
    'spellcheck/spell-checker': [
      'warn',
      {
        comments: true,
        strings: true,
        identifiers: true,
        lang: 'en_US',
        skipWords: cspell,
        skipIfMatch: ['http?://[^s]*', '^[-\\w]+/[-\\w\\.]+$'],
        skipWordIfMatch: [],
        minLength: 3
      }
    ],
    'lines-between-class-members': [
      'error',
      'always',
      { exceptAfterSingleLine: true }
    ],
    'import/no-unresolved': [
      'error',
      {
        ignore: ['^~']
      }
    ],
    'no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        vars: 'all'
      }
    ],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        vars: 'all'
      }
    ],
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          '**/*.spec.js',
          '**/*.spec.jsx',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/*.story.js',
          '**/*.story.jsx',
          '**/*.story.ts',
          '**/*.story.tsx',
          '**/*.test.js',
          '**/*.test.jsx',
          '**/*.test.ts',
          '**/*.test.tsx',
          'storybook/**/*.js',
          'storybook/**/*.jsx',
          'storybook/**/*.ts',
          'storybook/**/*.tsx',
          'tests/*.js',
          'tests/*.jsx',
          'tests/*.ts',
          'tests/*.tsx'
        ]
      }
    ]
  },
  overrides: [
    {
      files: ['*.test.js', '*.test.jsx', '*.test.ts', '*.test.tsx'],
      env: {
        jest: true
      },
      plugins: ['jest']
    },
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-unused-vars': 'off'
      }
    }
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }
    }
  }
};
