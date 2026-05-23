import { test, expect } from '@playwright/test';

const AUTH = { headers: { Authorization: 'Bearer test-bearer-token-xyz' } };

// Reset before every test — full isolation
test.beforeEach(async ({ request }) => {
  await request.post('/test/reset');
});

test('GET /items returns exactly the 3 seeded items', async ({ request }) => {
  const response = await request.get('/items', AUTH);
  expect(response.status()).toBe(200);
  const items = await response.json();
  expect(items).toHaveLength(3);
  expect(items.map((i: { name: string }) => i.name)).toEqual(['Apple', 'Banana', 'Cherry']);
});

test('POST /items adds a 4th item — list grows to 4', async ({ request }) => {
  await request.post('/items', { ...AUTH, data: { name: 'Dragonfruit', price: 5.00 } });
  const list = await request.get('/items', AUTH);
  const items = await list.json();
  expect(items).toHaveLength(4);
  expect(items[3].name).toBe('Dragonfruit');
});

test('DELETE /items/1 removes Apple — list shrinks to 2', async ({ request }) => {
  await request.delete('/items/1', AUTH);
  const list = await request.get('/items', AUTH);
  const items = await list.json();
  expect(items).toHaveLength(2);
  expect(items.find((i: { name: string }) => i.name === 'Apple')).toBeUndefined();
});

test('second run still sees exactly 3 items — proving beforeEach isolated the previous test', async ({ request }) => {
  const list = await request.get('/items', AUTH);
  const items = await list.json();
  expect(items).toHaveLength(3);
});
