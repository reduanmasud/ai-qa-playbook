import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3020',
    headless: true,
  },
  webServer: {
    command: `node ${path.join(__dirname, 'demo/server.js')}`,
    port: 3020,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
