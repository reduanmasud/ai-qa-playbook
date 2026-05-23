import { defineConfig } from '@playwright/test';

const targetHost = process.env.TARGET_HOST ?? 'http://localhost';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: targetHost,
    headless: true,
    ignoreHTTPSErrors: false,
  },
  timeout: 30000,
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
