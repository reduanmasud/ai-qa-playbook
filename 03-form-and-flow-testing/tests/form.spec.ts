import { test, expect } from '@playwright/test';
import path from 'path';

const loginUrl = `file://${path.resolve(__dirname, '../demo/index.html')}`;

test('valid credentials navigate to dashboard', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'password123');
  await page.click('#submit');
  await expect(page).toHaveTitle('Dashboard');
  await expect(page.locator('h1')).toHaveText('Dashboard');
});

test('wrong password shows error message', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'wrongpassword');
  await page.click('#submit');
  await expect(page.locator('#error-message')).toBeVisible();
  await expect(page.locator('#error-message')).toHaveText('Invalid email or password.');
});

test('wrong email shows invalid credentials error', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#email', 'wrong@example.com');
  await page.fill('#password', 'password123');
  await page.click('#submit');
  await expect(page.locator('#error-message')).toHaveText('Invalid email or password.');
});

test('empty email shows required error', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#password', 'password123');
  await page.click('#submit');
  await expect(page.locator('#error-message')).toBeVisible();
  await expect(page.locator('#error-message')).toHaveText('Email and password are required.');
});

test('empty password shows required error', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#email', 'admin@example.com');
  await page.click('#submit');
  await expect(page.locator('#error-message')).toBeVisible();
  await expect(page.locator('#error-message')).toHaveText('Email and password are required.');
});
