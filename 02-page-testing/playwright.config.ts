import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { headless: true },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
