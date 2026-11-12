module.exports = {
    root: true,
    extends: 'airbnb',

    env: {
        node: true,
        browser: true,
        es2021: true,
        webextensions: true
    },

    ignorePatterns: ['.output'],

    plugins: [
        '@typescript-eslint'
    ],

    parser: '@typescript-eslint/parser',

    parserOptions: {
        ecmaVersion: 14,
        parser: '@typescript-eslint/parser',
        sourceType: 'module'
    },

    globals: {
        defineUnlistedScript: 'readonly',
        defineContentScript: 'readonly',
        defineBackground: 'readonly',
        RequestInit: 'readonly',
        injectScript: 'readonly'
    },

    overrides: [
        {
            // tsc already checks undefined identifiers, and no-undef doesn't understand TS-only globals like DOM types.
            files: ['*.ts', '*.tsx'],
            rules: { 'no-undef': 'off' }
        },
        {
            // Preact (automatic JSX runtime, `class` attribute), not React; airbnb's React rules assume React.
            files: ['*.tsx'],
            rules: {
                'react/react-in-jsx-scope': 'off',
                'react/jsx-filename-extension': ['error', { extensions: ['.tsx'] }],
                'react/no-unknown-property': 'off',
                'react/jsx-indent': ['error', 4],
                'react/jsx-indent-props': ['error', 4],
                'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 3 }]
            }
        }
    ],

    rules: {
        'no-alert': 'off',
        'no-console': 'off',
        'no-useless-constructor': 'off',
        'no-empty-function': 'off',
        'no-use-before-define': 'off',
        'no-param-reassign': 'off',
        'object-curly-newline': 'off',
        indent: ['error', 4],
        semi: [2, 'always'],
        'no-unused-vars': 'off',
        'no-new': 'off',
        quotes: ['error', 'single'],
        'comma-dangle': ['error', 'never'],
        'max-len': ['error', 120],
        'class-methods-use-this': 'off',
        'import/no-unresolved': 'off',
        'lines-between-class-members': 'off',
        'no-await-in-loop': 'off',
        'no-underscore-dangle': 'off',
        'no-plusplus': 'off',
        'consistent-return': 'off',
        'no-unused-expressions': 'off',
        'no-restricted-syntax': 'off',
        'import/extensions': 'off',
        'import/prefer-default-export': ['off', 'any'],
        'import/no-extraneous-dependencies': ['off']
    }
};
