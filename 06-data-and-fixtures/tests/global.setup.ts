import { request } from '@playwright/test';

export default async function globalSetup() {
  const api = await request.newContext({ baseURL: 'http://localhost:3003' });
  const response = await api.post('/test/reset');
  if (response.status() !== 200) {
    throw new Error(`Global setup failed: could not reset DB (${response.status()})`);
  }
  console.log('[global setup] Database seeded with 3 items');
  await api.dispose();
}
