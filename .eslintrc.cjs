/**
 * Repo-root ESLint config.
 *
 * This previously lived in system/, where the lint script also ran. Because system/ is
 * the Vite root and holds no application code, `eslint .` matched exactly one file
 * (vite.config.ts) and the entire src/ tree went unlinted. Config at the root means
 * ESLint finds it by walking up from any linted file, whatever the working directory.
 */
module.exports = {
    root: true,
    ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
    overrides: [
        {
            // Frontend application: React + TypeScript, browser globals.
            files: ['src/**/*.ts', 'src/**/*.tsx'],
            env: { browser: true, es2020: true },
            parser: '@typescript-eslint/parser',
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
            extends: [
                'eslint:recommended',
                'plugin:@typescript-eslint/recommended',
                'plugin:react-hooks/recommended',
            ],
            plugins: ['react-refresh'],
            rules: {
                'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
                '@typescript-eslint/no-explicit-any': 'off',
                // Defer to the TypeScript-aware rule; the base rule misreports type-only usage.
                'no-unused-vars': 'off',
                '@typescript-eslint/no-unused-vars': ['warn', {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    // `const { id: _, ...rest } = obj` is how a field is omitted; the named
                    // binding is intentionally discarded, not forgotten.
                    ignoreRestSiblings: true,
                }],
            },
        },
        {
            // Archive Engine: CommonJS on Node.
            files: ['backend/**/*.js', 'api/**/*.js'],
            env: { node: true, es2022: true },
            parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
            extends: ['eslint:recommended'],
            rules: {
                // `catch (_) {}` is used deliberately for best-effort SSE writes.
                'no-empty': ['error', { allowEmptyCatch: true }],
            },
        },
        {
            // Build tooling and root-level config files.
            files: ['system/**/*.ts', 'system/**/*.js', '*.js', '*.cjs'],
            env: { node: true, es2022: true },
            parser: '@typescript-eslint/parser',
            parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
            extends: ['eslint:recommended'],
        },
    ],
};
