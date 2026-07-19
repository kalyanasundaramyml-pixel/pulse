import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    hookTimeout: 30000,
    testTimeout: 30000,
    fileParallelism: false,
    setupFiles: ['./tests/setupEnv.ts'],
  },
});
