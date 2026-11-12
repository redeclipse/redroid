const js = require('@eslint/js');
const stylistic = require('@stylistic/eslint-plugin');
const globals = require('globals');

module.exports = [
    { ignores: ['node_modules/', 'db/'] },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: globals.node,
        },
        plugins: { '@stylistic': stylistic },
        rules: {
            'curly': ['error', 'multi-line', 'consistent'],
            'max-nested-callbacks': ['error', { max: 4 }],
            'no-empty-function': 'error',
            'no-fallthrough': ['error', { commentPattern: 'fall-through|fallthrough' }],
            'no-lonely-if': 'error',
            'no-shadow': ['error', { allow: ['err', 'resolve', 'reject'] }],
            'no-unused-vars': 'warn',
            'no-var': 'error',
            'prefer-const': 'error',
            'yoda': 'error',

            '@stylistic/arrow-spacing': ['warn', { before: true, after: true }],
            '@stylistic/brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
            '@stylistic/comma-dangle': ['error', 'only-multiline'],
            '@stylistic/comma-spacing': 'error',
            '@stylistic/comma-style': 'error',
            '@stylistic/dot-location': ['error', 'property'],
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
            '@stylistic/max-statements-per-line': ['error', { max: 2 }],
            '@stylistic/no-floating-decimal': 'error',
            '@stylistic/no-mixed-spaces-and-tabs': 'error',
            '@stylistic/no-multi-spaces': 'error',
            '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1, maxBOF: 0 }],
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/space-before-blocks': 'error',
            '@stylistic/space-before-function-paren': ['error', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
            '@stylistic/space-in-parens': 'error',
            '@stylistic/space-infix-ops': ['error', { int32Hint: false }],
            '@stylistic/space-unary-ops': 'error',
            '@stylistic/spaced-comment': 'error',
        },
    },
];
