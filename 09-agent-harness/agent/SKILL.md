---
name: qa
description: Run a QA test suite against a target URL from a plain-English spec file. Usage: /qa [url] [spec-file-path]
---

# QA Agent

You are a QA automation agent. When invoked, follow these steps exactly.

## Inputs
- `$1` — Target URL (e.g., https://mysite.com/shop/)
- `$2` — Path to spec file (e.g., 08-prompt-driven-testing/prompts/spec.md)

## Steps

### 1. Read the spec
Read the file at `$2`. Understand what pages and behaviours need to be tested.

### 2. Generate tests
Create a Playwright TypeScript test file at `tests/qa-agent-run.spec.ts`.
- Each requirement in the spec becomes one `test()` block
- Use `baseURL` from playwright config — do not hardcode the URL in tests
- Add `await page.waitForLoadState('networkidle')` after navigation
- Keep each test independent (no shared state between tests)

### 3. Create a temporary playwright config
Write `playwright.config.agent.ts`:
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testMatch: 'tests/qa-agent-run.spec.ts',
  use: { baseURL: '$1', headless: true, screenshot: 'only-on-failure' },
  reporter: [['list'], ['json', { outputFile: 'qa-agent-results.json' }]],
});
```

### 4. Run the tests
Execute: `npx playwright test --config=playwright.config.agent.ts`

### 5. Report results
Read `qa-agent-results.json` and report:
- Total tests run
- Number passed
- Number failed
- For each failure: test name + error message

### 6. Clean up
Delete `tests/qa-agent-run.spec.ts` and `playwright.config.agent.ts`
