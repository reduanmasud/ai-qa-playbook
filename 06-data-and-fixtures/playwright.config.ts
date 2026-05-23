import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  globalSetup: path.join(__dirname, 'tests/global.setup.ts'),
  globalTeardown: path.join(__dirname, 'tests/global.teardown.ts'),
  use: {
    baseURL: 'http://localhost:3003',
    headless: true,
  },
  webServer: {
    command: `node ${path.join(__dirname, 'demo/server.js')}`,
    port: 3003,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
