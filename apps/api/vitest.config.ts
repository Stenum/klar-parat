import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 30000,
    singleThread: true,
    maxConcurrency: 1,
    sequence: {
      concurrent: false
    }
  }
});
