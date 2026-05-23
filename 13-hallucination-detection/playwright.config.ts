import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3013',
    headless: true,
  },
  timeout: 30000,
  webServer: {
    command: `node ${path.join(__dirname, 'demo/server.js')}`,
    port: 3013,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
