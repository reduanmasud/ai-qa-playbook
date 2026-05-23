import { test, expect } from '@playwright/test';

test('GET /items returns an array of items', async ({ request }) => {
  const response = await request.get('/items');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBeGreaterThan(0);
  expect(body[0]).toHaveProperty('id');
  expect(body[0]).toHaveProperty('name');
  expect(body[0]).toHaveProperty('price');
});

test('POST /items creates a new item and returns 201', async ({ request }) => {
  const response = await request.post('/items', {
    data: { name: 'Cherry', price: 3.00 },
  });
  expect(response.status()).toBe(201);
  const item = await response.json();
  expect(item.name).toBe('Cherry');
  expect(item.price).toBe(3.00);
  expect(item.id).toBeDefined();
});

test('POST /items with missing price returns 400', async ({ request }) => {
  const response = await request.post('/items', {
    data: { name: 'Cherry' },
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBeDefined();
});

test('DELETE /items/:id removes the item', async ({ request }) => {
  const create = await request.post('/items', {
    data: { name: 'Temp', price: 9.99 },
  });
  const created = await create.json();

  const del = await request.delete(`/items/${created.id}`);
  expect(del.status()).toBe(204);

  const list = await request.get('/items');
  const items = await list.json();
  expect(items.find((i: { id: number }) => i.id === created.id)).toBeUndefined();
});

test('DELETE /items/:id with unknown id returns 404', async ({ request }) => {
  const response = await request.delete('/items/99999');
  expect(response.status()).toBe(404);
});
