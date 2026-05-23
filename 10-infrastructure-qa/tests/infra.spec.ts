import { test, expect } from '@playwright/test';

const TARGET_HOST = process.env.TARGET_HOST ?? 'http://localhost';
const API_URL = process.env.API_URL ?? `${TARGET_HOST}/api`;

test('server responds to HTTP GET with a non-5xx status', async ({ request }) => {
  const response = await request.get(TARGET_HOST, { timeout: 15000 });
  expect(response.status()).toBeLessThan(500);
});

test('HTTP request redirects to HTTPS', async ({ page }) => {
  const httpUrl = TARGET_HOST.replace(/^https:\/\//, 'http://');
  const response = await page.goto(httpUrl, { timeout: 15000 });
  expect(response?.url()).toMatch(/^https:\/\//);
});

test('response includes nginx server header', async ({ request }) => {
  const response = await request.get(TARGET_HOST);
  const serverHeader = response.headers()['server'] ?? '';
  expect(serverHeader.toLowerCase()).toContain('nginx');
});

test('GET /api/health returns 200', async ({ request }) => {
  const response = await request.get(`${API_URL}/health`, { timeout: 15000 });
  expect(response.status()).toBe(200);
});

test('GET /api/health body has status: ok', async ({ request }) => {
  const response = await request.get(`${API_URL}/health`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('ok');
});

test('HTTPS connection succeeds without certificate error', async ({ request }) => {
  const httpsUrl = TARGET_HOST.startsWith('https://')
    ? TARGET_HOST
    : TARGET_HOST.replace('http://', 'https://');
  const response = await request.get(httpsUrl, { timeout: 15000 });
  expect(response.status()).toBeLessThan(500);
});

test('API returns CORS header for trusted origin', async ({ request }) => {
  const response = await request.get(`${API_URL}/health`, {
    headers: { Origin: 'https://trusted.com' },
  });
  const corsHeader = response.headers()['access-control-allow-origin'];
  expect(corsHeader).toBeDefined();
});
