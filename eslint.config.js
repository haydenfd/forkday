import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'out', 'dist', 'release'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: tseslint.configs.recommended,
  },
);
