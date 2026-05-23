import { test, expect } from '@playwright/test';

let authToken: string;

test.beforeAll(async ({ request }) => {
  const response = await request.post('/auth/login', {
    data: { username: 'admin', password: 'password123' },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  authToken = body.token;
});

test('GET /items with valid token returns item list', async ({ request }) => {
  const response = await request.get('/items', {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(response.status()).toBe(200);
  const items = await response.json();
  expect(Array.isArray(items)).toBe(true);
  expect(items.length).toBeGreaterThan(0);
});

test('GET /items without token returns 401', async ({ request }) => {
  const response = await request.get('/items');
  expect(response.status()).toBe(401);
});

test('GET /items with wrong token returns 401', async ({ request }) => {
  const response = await request.get('/items', {
    headers: { Authorization: 'Bearer wrong-token' },
  });
  expect(response.status()).toBe(401);
});

test('POST /items with valid token creates item', async ({ request }) => {
  const response = await request.post('/items', {
    headers: { Authorization: `Bearer ${authToken}` },
    data: { name: 'Mango', price: 2.50 },
  });
  expect(response.status()).toBe(201);
  const item = await response.json();
  expect(item.name).toBe('Mango');
  expect(item.id).toBeDefined();
});

test('POST /items without token returns 401', async ({ request }) => {
  const response = await request.post('/items', {
    data: { name: 'Mango', price: 2.50 },
  });
  expect(response.status()).toBe(401);
});
