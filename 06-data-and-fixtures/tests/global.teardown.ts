import { request } from '@playwright/test';

export default async function globalTeardown() {
  const api = await request.newContext({ baseURL: 'http://localhost:3003' });
  await api.post('/test/reset');
  console.log('[global teardown] Database reset to clean state');
  await api.dispose();
}
