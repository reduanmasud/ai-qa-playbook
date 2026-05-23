import { test, expect } from '@playwright/test';
import path from 'path';

const homeUrl = `file://${path.resolve(__dirname, '../demo/index.html')}`;
const aboutUrl = `file://${path.resolve(__dirname, '../demo/about.html')}`;

test('home page has correct title', async ({ page }) => {
  await page.goto(homeUrl);
  await expect(page).toHaveTitle('My Company — Home');
});

test('home page has main heading', async ({ page }) => {
  await page.goto(homeUrl);
  await expect(page.locator('h1')).toHaveText('Welcome to My Company');
});

test('home page nav contains Home and About links', async ({ page }) => {
  await page.goto(homeUrl);
  await expect(page.locator('#nav-home')).toBeVisible();
  await expect(page.locator('#nav-about')).toBeVisible();
});

test('clicking About nav link loads about page', async ({ page }) => {
  await page.goto(homeUrl);
  await page.click('#nav-about');
  await expect(page).toHaveTitle('My Company — About');
  await expect(page.locator('h1')).toHaveText('About Us');
});

test('about page back-home link returns to home', async ({ page }) => {
  await page.goto(aboutUrl);
  await page.click('#back-home');
  await expect(page).toHaveTitle('My Company — Home');
});
