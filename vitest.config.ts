import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'playground/server/**/*.test.ts',
      'playground/test/**/*.test.ts',
    ],
    environment: 'node',
  },
});
