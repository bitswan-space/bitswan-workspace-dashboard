import { defineConfig } from 'vitest/config';

// Tests live in server/test/*.test.ts. Use the Node environment (we test
// Fastify request injection + file system scans, no DOM).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
});
