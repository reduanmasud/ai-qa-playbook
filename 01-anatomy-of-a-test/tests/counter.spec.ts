import { test, expect } from '@playwright/test';
import path from 'path';

const demoUrl = `file://${path.resolve(__dirname, '../demo/index.html')}`;

test('counter starts at zero on page load', async ({ page }) => {
  // Arrange + Assert (no Act — testing initial state)
  await page.goto(demoUrl);
  await expect(page.locator('#count')).toHaveText('0');
});

test('clicking increment once shows 1', async ({ page }) => {
  await page.goto(demoUrl);         // Arrange
  await page.click('#increment');   // Act
  await expect(page.locator('#count')).toHaveText('1'); // Assert
});

test('clicking increment three times shows 3', async ({ page }) => {
  await page.goto(demoUrl);
  await page.click('#increment');
  await page.click('#increment');
  await page.click('#increment');
  await expect(page.locator('#count')).toHaveText('3');
});

test('reset sets counter back to zero after incrementing', async ({ page }) => {
  await page.goto(demoUrl);
  await page.click('#increment');
  await page.click('#increment');
  await page.click('#reset');
  await expect(page.locator('#count')).toHaveText('0');
});
