import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules', 'dist', 'tests/integration/**/*'],
    environment: 'node',
    setupFiles: ['./tests/unit/setup.ts'],
  },
});
