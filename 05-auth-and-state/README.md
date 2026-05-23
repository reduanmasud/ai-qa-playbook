# Tutorial 05 — Auth and State

## What You Will Learn
- How bearer token authentication works
- Why logging in before every test is slow and fragile
- How to log in once per test suite using `test.beforeAll`
- The concept of shared test state

## The Problem with Per-Test Login

If every test logs in individually:
- 100 tests = 100 login requests
- If the login endpoint is slow, your suite is slow
- If the login endpoint breaks, every test fails (not just auth tests)

**Solution**: Log in once before the suite starts. Share the token across all tests.

## How It Works

```typescript
let authToken: string;

test.beforeAll(async ({ request }) => {
  const res = await request.post('/auth/login', { data: { username, password } });
  authToken = (await res.json()).token;  // saved once
});

test('some protected endpoint', async ({ request }) => {
  const res = await request.get('/items', {
    headers: { Authorization: `Bearer ${authToken}` },  // reused
  });
});
```

## The Demo
The Tutorial 04 API, now protected by Bearer token auth.
Login: POST /auth/login with { username: "admin", password: "password123" }

## Running the Tests
```bash
npm run test:05
```
