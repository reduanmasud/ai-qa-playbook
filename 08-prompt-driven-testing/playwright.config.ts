import { defineConfig } from '@playwright/test';

const testUrl = process.env.TEST_URL ?? 'https://woocommerce.com';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: testUrl,
    headless: true,
    screenshot: 'only-on-failure',
  },
  timeout: 30000,
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
