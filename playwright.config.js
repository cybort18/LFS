import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  timeout: 30000,
  webServer: {
    command: 'node core/server.js',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test'
    }
  },
  use: {
    headless: true,
  },
});
