import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
	{
		files: ['**/*.{js,mjs,cjs,ts}'],
	},
	{
		languageOptions: {
			globals: globals.browser,
		},
	},
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			// Disable unused variables checking
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'no-unused-vars': 'off',
		},
	},
	{
		ignores: [
			'node_modules',
			'out',
			'public',
			'.next',
			'build',
			'dist',
			'cypress',
			'__test__',
			'eslint.config.js',
			'.husky',
			'prisma',
			'tests/integration',
		],
	},
];
