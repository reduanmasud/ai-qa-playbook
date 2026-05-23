# Tutorial 06 — Data and Fixtures

## What You Will Learn
- What "test pollution" is and why it breaks suites
- The difference between global setup/teardown and per-test setup
- How to reset database state before each test for full isolation
- Why isolated tests are worth the extra setup cost

## What is Test Pollution?

Test A creates an item. Test B deletes all items and expects a count of 0.
If Test A runs before Test B, Test B finds 1 item and fails.
The tests pollute each other's state.

**Solution**: Reset to a known state before each test with `test.beforeEach`.

## Levels of Setup

| Level | When it runs | Use for |
|-------|-------------|---------|
| `globalSetup` | Once before the entire suite | Start services, seed reference data |
| `test.beforeAll` | Once before tests in a file | File-scoped setup |
| `test.beforeEach` | Before every single test | Full isolation — reset state |
| `globalTeardown` | Once after the entire suite | Clean up services |

## The Demo
The auth API with a `/test/reset` endpoint that restores the database to seed state.

## Running the Tests
```bash
npm run test:06
```
