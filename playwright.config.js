import { defineConfig } from '@playwright/test';

// Keep Playwright from loading Node's unit/integration *.test.js files.
// Individual browser suites manage their own servers or document the real
// services they require; starting a substitute server here would hide failures.
export default defineConfig({
  testDir: process.env.PLAYWRIGHT_TEST_DIR || './e2e',
  testMatch: '**/*.spec.js',
  timeout: 120_000,
});
