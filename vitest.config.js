import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.js'],
    setupFiles: ['./tests/setup-env.js'],
    include: ['tests/**/*.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000,
    // Test files share one MySQL database, so run them one at a time.
    fileParallelism: false,
  },
})
