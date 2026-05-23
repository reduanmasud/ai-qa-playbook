# QA Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a 10-tutorial progressive QA learning curriculum — each tutorial is a self-contained folder with a demo target, Playwright test harness, and plain-English prompt specs, graduating from static HTML tests to a cloud infrastructure QA agent.

**Architecture:** Root-level Playwright + TypeScript installation shared across all tutorials. Tutorials 01–03 test static HTML via `file://`. Tutorials 04–06 spin up a local Express server via Playwright's `webServer` config. Tutorial 07 produces a GitHub Actions workflow. Tutorials 08–10 shift to prompt-driven and agent-based testing.

**Tech Stack:** Node.js 18+, `@playwright/test` ^1.44.0, TypeScript 5+, Express 4 (API demos)

---

### Task 0: Root Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "qa-curriculum",
  "private": true,
  "scripts": {
    "test:01": "npx playwright test --config=01-anatomy-of-a-test/playwright.config.ts",
    "test:02": "npx playwright test --config=02-page-testing/playwright.config.ts",
    "test:03": "npx playwright test --config=03-form-and-flow-testing/playwright.config.ts",
    "test:04": "npx playwright test --config=04-api-testing/playwright.config.ts",
    "test:05": "npx playwright test --config=05-auth-and-state/playwright.config.ts",
    "test:06": "npx playwright test --config=06-data-and-fixtures/playwright.config.ts"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
playwright-report/
test-results/
.auth/
*.auth.json
results.json
```

- [ ] **Step 4: Install dependencies**

Run: `npm install && npx playwright install chromium`
Expected: `node_modules/` created, chromium browser downloaded

- [ ] **Step 5: Commit**

```bash
git init
git add package.json tsconfig.json .gitignore
git commit -m "chore: initialize QA curriculum root project"
```

---

### Task 1: Tutorial 01 — Anatomy of a Test

**Files:**
- Create: `01-anatomy-of-a-test/README.md`
- Create: `01-anatomy-of-a-test/playwright.config.ts`
- Create: `01-anatomy-of-a-test/demo/index.html`
- Create: `01-anatomy-of-a-test/tests/counter.spec.ts`
- Create: `01-anatomy-of-a-test/prompts/spec.md`

- [ ] **Step 1: Create `01-anatomy-of-a-test/README.md`**

```markdown
# Tutorial 01 — Anatomy of a Test

## What You Will Learn
- What a test is and why it exists
- The three parts of every test: Arrange, Act, Assert (AAA)
- What "passing" and "failing" mean in practice
- How to read a Playwright test file

## The Three-Part Structure

Every test — regardless of framework — has three parts:

**Arrange** — Set up starting state. Load the page, prepare data.
**Act** — Do the thing under test. Click a button, submit a form.
**Assert** — Verify the outcome matches expectation.

```typescript
test('clicking increment once shows 1', async ({ page }) => {
  await page.goto(demoUrl);        // Arrange
  await page.click('#increment');  // Act
  await expect(page.locator('#count')).toHaveText('1'); // Assert
});
```

## The Demo
A counter page. Increment button adds 1. Reset sets back to 0.

## Running the Tests
```bash
npm run test:01
```

## What to Notice
- Each test is independent — it loads the page fresh every time
- Test names describe expected *behaviour*, not implementation steps
- A failing test tells you exactly which assertion broke and why
```

- [ ] **Step 2: Create `01-anatomy-of-a-test/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { headless: true },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
```

- [ ] **Step 3: Create `01-anatomy-of-a-test/demo/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Counter Demo</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; }
    button { margin: 0.5rem; padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; }
    #count { font-size: 2rem; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Counter: <span id="count">0</span></h1>
  <button id="increment">Increment</button>
  <button id="reset">Reset</button>
  <script>
    let count = 0;
    const display = document.getElementById('count');
    document.getElementById('increment').addEventListener('click', function () {
      count++;
      display.textContent = count;
    });
    document.getElementById('reset').addEventListener('click', function () {
      count = 0;
      display.textContent = count;
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Create `01-anatomy-of-a-test/tests/counter.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

const demoUrl = `file://${path.resolve(__dirname, '../demo/index.html')}`;

test('counter starts at zero on page load', async ({ page }) => {
  // Arrange + Assert (no Act — testing initial state)
  await page.goto(demoUrl);
  await expect(page.locator('#count')).toHaveText('0');
});

test('clicking increment once shows 1', async ({ page }) => {
  await page.goto(demoUrl);         // Arrange
  await page.click('#increment');   // Act
  await expect(page.locator('#count')).toHaveText('1'); // Assert
});

test('clicking increment three times shows 3', async ({ page }) => {
  await page.goto(demoUrl);
  await page.click('#increment');
  await page.click('#increment');
  await page.click('#increment');
  await expect(page.locator('#count')).toHaveText('3');
});

test('reset sets counter back to zero after incrementing', async ({ page }) => {
  await page.goto(demoUrl);
  await page.click('#increment');
  await page.click('#increment');
  await page.click('#reset');
  await expect(page.locator('#count')).toHaveText('0');
});
```

- [ ] **Step 5: Create `01-anatomy-of-a-test/prompts/spec.md`**

```markdown
# Test Spec — Counter

## Target
file://[absolute-path]/01-anatomy-of-a-test/demo/index.html

## Tests Required
1. On page load, counter displays "0"
2. Clicking Increment once shows "1"
3. Clicking Increment three times shows "3"
4. Clicking Reset after two increments shows "0"

## Assertions
- `#count` element text must equal the expected number
- Each test loads the page fresh (no shared state)

## Notes for Claude
Use TypeScript. Use `page.goto()` with the file:// URL.
Use `page.click()` for buttons. Use `expect(locator).toHaveText()` for assertions.
Add // Arrange, // Act, // Assert comments in each test.
```

- [ ] **Step 6: Run and verify**

Run: `npm run test:01`
Expected:
```
✓ counter starts at zero on page load
✓ clicking increment once shows 1
✓ clicking increment three times shows 3
✓ reset sets counter back to zero after incrementing
4 passed
```

- [ ] **Step 7: Commit**

```bash
git add 01-anatomy-of-a-test/
git commit -m "feat: add tutorial 01 — anatomy of a test"
```

---

### Task 2: Tutorial 02 — Page Testing

**Files:**
- Create: `02-page-testing/README.md`
- Create: `02-page-testing/playwright.config.ts`
- Create: `02-page-testing/demo/index.html`
- Create: `02-page-testing/demo/about.html`
- Create: `02-page-testing/tests/pages.spec.ts`
- Create: `02-page-testing/prompts/spec.md`

- [ ] **Step 1: Create `02-page-testing/README.md`**

```markdown
# Tutorial 02 — Page Testing

## What You Will Learn
- How to verify a page loads with correct content
- Testing page titles, headings, and nav links
- What "smoke tests" are — basic sanity checks run after every deployment
- How to assert navigation between pages works

## What is Page Testing?
Page tests are the first thing you run after a deployment.
If a page doesn't load or has wrong content, nothing else matters.

Common checks:
- Page title matches expected value
- Key headings are visible
- Navigation links are present and clickable
- Links navigate to the correct destination

## The Demo
A two-page mini-site: Home and About, connected by navigation.

## Running the Tests
```bash
npm run test:02
```
```

- [ ] **Step 2: Create `02-page-testing/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { headless: true },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
```

- [ ] **Step 3: Create `02-page-testing/demo/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Company — Home</title>
  <style>
    body { font-family: sans-serif; margin: 0; }
    nav { background: #333; padding: 1rem; }
    nav a { color: white; text-decoration: none; margin-right: 1rem; }
    main { padding: 2rem; }
  </style>
</head>
<body>
  <nav>
    <a href="index.html" id="nav-home">Home</a>
    <a href="about.html" id="nav-about">About</a>
  </nav>
  <main>
    <h1>Welcome to My Company</h1>
    <p>We build great software for great people.</p>
    <a href="about.html" id="learn-more">Learn more about us</a>
  </main>
</body>
</html>
```

- [ ] **Step 4: Create `02-page-testing/demo/about.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Company — About</title>
  <style>
    body { font-family: sans-serif; margin: 0; }
    nav { background: #333; padding: 1rem; }
    nav a { color: white; text-decoration: none; margin-right: 1rem; }
    main { padding: 2rem; }
  </style>
</head>
<body>
  <nav>
    <a href="index.html" id="nav-home">Home</a>
    <a href="about.html" id="nav-about">About</a>
  </nav>
  <main>
    <h1>About Us</h1>
    <p>Founded in 2020, we are a team of passionate developers.</p>
    <a href="index.html" id="back-home">Back to Home</a>
  </main>
</body>
</html>
```

- [ ] **Step 5: Create `02-page-testing/tests/pages.spec.ts`**

```typescript
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
```

- [ ] **Step 6: Create `02-page-testing/prompts/spec.md`**

```markdown
# Test Spec — Page Testing

## Target
- Home: file://[path]/02-page-testing/demo/index.html
- About: file://[path]/02-page-testing/demo/about.html

## Tests Required

### Home Page
1. Title is "My Company — Home"
2. h1 reads "Welcome to My Company"
3. Nav links #nav-home and #nav-about are visible
4. Clicking #nav-about loads about page with title "My Company — About"

### About Page
5. Clicking #back-home returns to a page with title "My Company — Home"

## Notes for Claude
Use `expect(page).toHaveTitle()` for title checks.
Use `expect(locator).toHaveText()` for heading text.
Use `expect(locator).toBeVisible()` for element presence.
```

- [ ] **Step 7: Run and verify**

Run: `npm run test:02`
Expected: `5 passed`

- [ ] **Step 8: Commit**

```bash
git add 02-page-testing/
git commit -m "feat: add tutorial 02 — page testing"
```

---

### Task 3: Tutorial 03 — Form and Flow Testing

**Files:**
- Create: `03-form-and-flow-testing/README.md`
- Create: `03-form-and-flow-testing/playwright.config.ts`
- Create: `03-form-and-flow-testing/demo/index.html`
- Create: `03-form-and-flow-testing/demo/dashboard.html`
- Create: `03-form-and-flow-testing/tests/form.spec.ts`
- Create: `03-form-and-flow-testing/prompts/spec.md`

- [ ] **Step 1: Create `03-form-and-flow-testing/README.md`**

```markdown
# Tutorial 03 — Form and Flow Testing

## What You Will Learn
- How to fill and submit forms with Playwright
- Happy path vs error path testing
- Why you must test both valid AND invalid inputs
- The concept of a "user flow" — a sequence of actions that achieves a goal

## Happy Path vs Error Path

**Happy path**: The user does everything correctly. Test that the expected outcome happens.
**Error path**: The user makes a mistake. Test that the right error message appears — not a crash or blank page.

For a login form, that means testing:
- Correct credentials → redirect to dashboard (happy path)
- Wrong password → error message (error path)
- Empty fields → required field error (error path)

## The Demo
A login form with client-side validation. Credentials: admin@example.com / password123

## Running the Tests
```bash
npm run test:03
```
```

- [ ] **Step 2: Create `03-form-and-flow-testing/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { headless: true },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
```

- [ ] **Step 3: Create `03-form-and-flow-testing/demo/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Login</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; max-width: 400px; }
    label { display: block; margin-top: 1rem; }
    input { width: 100%; padding: 0.5rem; margin-top: 0.25rem; box-sizing: border-box; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; width: 100%; font-size: 1rem; cursor: pointer; }
    #error-message { color: red; margin-top: 0.75rem; display: none; }
  </style>
</head>
<body>
  <h1>Login</h1>
  <form id="login-form">
    <label for="email">Email</label>
    <input type="text" id="email" name="email" placeholder="you@example.com">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" placeholder="Password">
    <div id="error-message"></div>
    <button type="submit" id="submit">Login</button>
  </form>
  <script>
    document.getElementById('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('error-message');

      if (!email || !password) {
        errorEl.textContent = 'Email and password are required.';
        errorEl.style.display = 'block';
        return;
      }
      if (email !== 'admin@example.com' || password !== 'password123') {
        errorEl.textContent = 'Invalid email or password.';
        errorEl.style.display = 'block';
        return;
      }
      window.location.href = 'dashboard.html';
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Create `03-form-and-flow-testing/demo/dashboard.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dashboard</title>
  <style>body { font-family: sans-serif; padding: 2rem; }</style>
</head>
<body>
  <h1>Dashboard</h1>
  <p id="welcome-message">Welcome, Admin! You are now logged in.</p>
</body>
</html>
```

- [ ] **Step 5: Create `03-form-and-flow-testing/tests/form.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

const loginUrl = `file://${path.resolve(__dirname, '../demo/index.html')}`;

test('valid credentials navigate to dashboard', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'password123');
  await page.click('#submit');
  await expect(page).toHaveTitle('Dashboard');
  await expect(page.locator('h1')).toHaveText('Dashboard');
});

test('wrong password shows error message', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'wrongpassword');
  await page.click('#submit');
  await expect(page.locator('#error-message')).toBeVisible();
  await expect(page.locator('#error-message')).toHaveText('Invalid email or password.');
});

test('wrong email shows invalid credentials error', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#email', 'wrong@example.com');
  await page.fill('#password', 'password123');
  await page.click('#submit');
  await expect(page.locator('#error-message')).toHaveText('Invalid email or password.');
});

test('empty email shows required error', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#password', 'password123');
  await page.click('#submit');
  await expect(page.locator('#error-message')).toBeVisible();
  await expect(page.locator('#error-message')).toHaveText('Email and password are required.');
});

test('empty password shows required error', async ({ page }) => {
  await page.goto(loginUrl);
  await page.fill('#email', 'admin@example.com');
  await page.click('#submit');
  await expect(page.locator('#error-message')).toBeVisible();
  await expect(page.locator('#error-message')).toHaveText('Email and password are required.');
});
```

- [ ] **Step 6: Create `03-form-and-flow-testing/prompts/spec.md`**

```markdown
# Test Spec — Login Form

## Target
file://[path]/03-form-and-flow-testing/demo/index.html

## Valid Credentials
Email: admin@example.com | Password: password123

## Tests Required

### Happy Path
1. Fill email + password with valid credentials → clicks submit → lands on page with title "Dashboard"

### Error Paths
2. Wrong password → #error-message shows "Invalid email or password."
3. Wrong email → #error-message shows "Invalid email or password."
4. Empty email field → #error-message shows "Email and password are required."
5. Empty password field → #error-message shows "Email and password are required."

## Notes for Claude
Use `page.fill('#id', 'value')` to fill inputs.
Use `expect(locator).toBeVisible()` to check error visibility.
Use `expect(locator).toHaveText()` for exact error text.
Each test must load the page fresh with `page.goto()`.
```

- [ ] **Step 7: Run and verify**

Run: `npm run test:03`
Expected: `5 passed`

- [ ] **Step 8: Commit**

```bash
git add 03-form-and-flow-testing/
git commit -m "feat: add tutorial 03 — form and flow testing"
```

---

### Task 4: Tutorial 04 — API Testing

**Files:**
- Create: `04-api-testing/README.md`
- Create: `04-api-testing/playwright.config.ts`
- Create: `04-api-testing/demo/server.js`
- Create: `04-api-testing/tests/api.spec.ts`
- Create: `04-api-testing/prompts/spec.md`

- [ ] **Step 1: Create `04-api-testing/README.md`**

```markdown
# Tutorial 04 — API Testing

## What You Will Learn
- The difference between UI testing (browser) and API testing (HTTP requests)
- HTTP methods: GET, POST, DELETE — and when each is used
- Status codes: what 200, 201, 400, 404 mean
- How to use Playwright's `request` context (no browser required)

## UI vs API Testing

UI tests simulate a user — they open a browser, click buttons, read text.
API tests send raw HTTP requests and check the response — faster, more targeted, no browser.

Most apps expose a REST API. Testing it directly catches bugs before they reach the UI.

## HTTP Status Codes You'll See
| Code | Meaning |
|------|---------|
| 200 | OK — request succeeded |
| 201 | Created — new resource made |
| 400 | Bad Request — your input was wrong |
| 404 | Not Found — resource doesn't exist |

## The Demo
A simple Express.js REST API for a list of items. Runs on port 3001.
Endpoints: GET /items, POST /items, DELETE /items/:id

## Running the Tests
```bash
npm run test:04
```
Playwright starts the server automatically, runs tests, then shuts it down.
```

- [ ] **Step 2: Create `04-api-testing/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
  webServer: {
    command: `node ${path.join(__dirname, 'demo/server.js')}`,
    port: 3001,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
```

- [ ] **Step 3: Create `04-api-testing/demo/server.js`**

```javascript
const express = require('express');
const app = express();
app.use(express.json());

let items = [
  { id: 1, name: 'Apple', price: 1.50 },
  { id: 2, name: 'Banana', price: 0.75 },
];
let nextId = 3;

app.get('/items', (req, res) => {
  res.json(items);
});

app.post('/items', (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  const item = { id: nextId++, name, price };
  items.push(item);
  res.status(201).json(item);
});

app.delete('/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  items.splice(index, 1);
  res.status(204).send();
});

app.listen(3001, () => console.log('API server at http://localhost:3001'));
```

- [ ] **Step 4: Create `04-api-testing/tests/api.spec.ts`**

```typescript
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
```

- [ ] **Step 5: Create `04-api-testing/prompts/spec.md`**

```markdown
# Test Spec — REST API

## Target
Base URL: http://localhost:3001
Server: node 04-api-testing/demo/server.js (start before running tests)

## Endpoints
- GET /items → returns array of { id, name, price }
- POST /items body: { name, price } → returns created item with id, status 201
- DELETE /items/:id → returns 204, or 404 if not found

## Tests Required
1. GET /items returns 200 and a non-empty array with id/name/price fields
2. POST /items with valid body returns 201 and the created item
3. POST /items with missing price returns 400 with an error field
4. DELETE /items/:id removes the item (verify with GET /items after)
5. DELETE /items/99999 returns 404

## Notes for Claude
Use Playwright's `request` fixture — no browser needed.
Use `request.get()`, `request.post()`, `request.delete()`.
Use `expect(response.status()).toBe(N)` for status codes.
Use `await response.json()` to read the body.
```

- [ ] **Step 6: Run and verify**

Run: `npm run test:04`
Expected: `5 passed`

- [ ] **Step 7: Commit**

```bash
git add 04-api-testing/
git commit -m "feat: add tutorial 04 — API testing"
```

---

### Task 5: Tutorial 05 — Auth and State

**Files:**
- Create: `05-auth-and-state/README.md`
- Create: `05-auth-and-state/playwright.config.ts`
- Create: `05-auth-and-state/demo/server.js`
- Create: `05-auth-and-state/tests/api.spec.ts`
- Create: `05-auth-and-state/prompts/spec.md`

- [ ] **Step 1: Create `05-auth-and-state/README.md`**

```markdown
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
```

- [ ] **Step 2: Create `05-auth-and-state/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
  },
  webServer: {
    command: `node ${path.join(__dirname, 'demo/server.js')}`,
    port: 3002,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
```

- [ ] **Step 3: Create `05-auth-and-state/demo/server.js`**

```javascript
const express = require('express');
const app = express();
app.use(express.json());

const VALID_TOKEN = 'test-bearer-token-xyz';
let items = [
  { id: 1, name: 'Apple', price: 1.50 },
  { id: 2, name: 'Banana', price: 0.75 },
];
let nextId = 3;

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password123') {
    return res.json({ token: VALID_TOKEN });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

function requireAuth(req, res, next) {
  if (req.headers.authorization === `Bearer ${VALID_TOKEN}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/items', requireAuth, (req, res) => res.json(items));

app.post('/items', requireAuth, (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });
  const item = { id: nextId++, name, price };
  items.push(item);
  res.status(201).json(item);
});

app.listen(3002, () => console.log('Auth API at http://localhost:3002'));
```

- [ ] **Step 4: Create `05-auth-and-state/tests/api.spec.ts`**

```typescript
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
```

- [ ] **Step 5: Create `05-auth-and-state/prompts/spec.md`**

```markdown
# Test Spec — Auth and State

## Target
Base URL: http://localhost:3002

## Auth Flow
POST /auth/login body: { username: "admin", password: "password123" }
Response: { token: "..." }
Use token as: Authorization: Bearer <token>

## Tests Required
1. Login returns 200 and a token
2. GET /items with valid token returns 200 and array
3. GET /items with no token returns 401
4. GET /items with wrong token returns 401
5. POST /items with valid token returns 201
6. POST /items without token returns 401

## Notes for Claude
Use `test.beforeAll` to log in once and store the token.
Pass `headers: { Authorization: \`Bearer \${token}\` }` to protected requests.
Do NOT log in inside each individual test.
```

- [ ] **Step 6: Run and verify**

Run: `npm run test:05`
Expected: `6 passed`

- [ ] **Step 7: Commit**

```bash
git add 05-auth-and-state/
git commit -m "feat: add tutorial 05 — auth and state"
```

---

### Task 6: Tutorial 06 — Data and Fixtures

**Files:**
- Create: `06-data-and-fixtures/README.md`
- Create: `06-data-and-fixtures/playwright.config.ts`
- Create: `06-data-and-fixtures/demo/server.js`
- Create: `06-data-and-fixtures/tests/global.setup.ts`
- Create: `06-data-and-fixtures/tests/global.teardown.ts`
- Create: `06-data-and-fixtures/tests/items.spec.ts`
- Create: `06-data-and-fixtures/prompts/spec.md`

- [ ] **Step 1: Create `06-data-and-fixtures/README.md`**

```markdown
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
```

- [ ] **Step 2: Create `06-data-and-fixtures/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  globalSetup: path.join(__dirname, 'tests/global.setup.ts'),
  globalTeardown: path.join(__dirname, 'tests/global.teardown.ts'),
  use: {
    baseURL: 'http://localhost:3003',
    headless: true,
  },
  webServer: {
    command: `node ${path.join(__dirname, 'demo/server.js')}`,
    port: 3003,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
```

- [ ] **Step 3: Create `06-data-and-fixtures/demo/server.js`**

```javascript
const express = require('express');
const app = express();
app.use(express.json());

const VALID_TOKEN = 'test-bearer-token-xyz';

const SEED = [
  { id: 1, name: 'Apple', price: 1.50 },
  { id: 2, name: 'Banana', price: 0.75 },
  { id: 3, name: 'Cherry', price: 3.00 },
];

let items = SEED.map(i => ({ ...i }));
let nextId = SEED.length + 1;

function requireAuth(req, res, next) {
  if (req.headers.authorization === `Bearer ${VALID_TOKEN}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Reset endpoint — restores to seed state
app.post('/test/reset', (req, res) => {
  items = SEED.map(i => ({ ...i }));
  nextId = SEED.length + 1;
  res.json({ message: 'Reset to seed state', count: items.length });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password123') {
    return res.json({ token: VALID_TOKEN });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/items', requireAuth, (req, res) => res.json(items));

app.post('/items', requireAuth, (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });
  const item = { id: nextId++, name, price };
  items.push(item);
  res.status(201).json(item);
});

app.delete('/items/:id', requireAuth, (req, res) => {
  const idx = items.findIndex(i => i.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items.splice(idx, 1);
  res.status(204).send();
});

app.listen(3003, () => console.log('Fixture API at http://localhost:3003'));
```

- [ ] **Step 4: Create `06-data-and-fixtures/tests/global.setup.ts`**

```typescript
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
```

- [ ] **Step 5: Create `06-data-and-fixtures/tests/global.teardown.ts`**

```typescript
import { request } from '@playwright/test';

export default async function globalTeardown() {
  const api = await request.newContext({ baseURL: 'http://localhost:3003' });
  await api.post('/test/reset');
  console.log('[global teardown] Database reset to clean state');
  await api.dispose();
}
```

- [ ] **Step 6: Create `06-data-and-fixtures/tests/items.spec.ts`**

```typescript
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
```

- [ ] **Step 7: Create `06-data-and-fixtures/prompts/spec.md`**

```markdown
# Test Spec — Data and Fixtures

## Target
Base URL: http://localhost:3003
Auth: Bearer test-bearer-token-xyz

## Reset Endpoint
POST /test/reset — restores database to 3 seed items: Apple, Banana, Cherry

## Tests Required
1. GET /items returns exactly 3 items: Apple, Banana, Cherry (in that order)
2. POST a new item → GET /items shows 4 items
3. DELETE /items/1 → GET /items shows 2 items, Apple is gone
4. A second GET /items still shows 3 items (proving test isolation reset the state)

## Critical Pattern
Call POST /test/reset in `test.beforeEach` so every test starts from the same 3-item baseline.
Without this, test 4 would fail because test 2 added an item.

## Notes for Claude
Use `test.beforeEach` to call the reset endpoint.
Assert array length with `expect(items).toHaveLength(N)`.
Assert item names with `.map(i => i.name)` and `toEqual([...])`.
```

- [ ] **Step 8: Run and verify**

Run: `npm run test:06`
Expected: `4 passed`

- [ ] **Step 9: Commit**

```bash
git add 06-data-and-fixtures/
git commit -m "feat: add tutorial 06 — data and fixtures"
```

---

### Task 7: Tutorial 07 — CI Pipeline

**Files:**
- Create: `07-ci-pipeline/README.md`
- Create: `07-ci-pipeline/prompts/spec.md`
- Create: `.github/workflows/qa.yml` (at repo root)

- [ ] **Step 1: Create `07-ci-pipeline/README.md`**

```markdown
# Tutorial 07 — CI Pipeline

## What You Will Learn
- What Continuous Integration (CI) is and why it matters
- How GitHub Actions works: triggers, jobs, steps
- How to read a failing CI run and find the failed test
- How to download and view the Playwright HTML report from a CI artifact

## What is CI?

CI (Continuous Integration) runs your tests automatically on every push or pull request.
You never merge broken code — the pipeline catches it first.

Without CI: Developer pushes code, breaks something, nobody notices until production.
With CI: Push → pipeline runs → if tests fail, the PR is blocked automatically.

## How GitHub Actions Works

```
Trigger (push/PR)
  └── Job: test
        ├── Step: checkout code
        ├── Step: install Node.js
        ├── Step: npm ci
        ├── Step: install Playwright browsers
        ├── Step: run tests
        └── Step: upload HTML report as artifact
```

## Reading a Failed CI Run
1. Click the red ✗ on the commit or PR
2. Open the failing job
3. Expand the failing step to see which test failed and why
4. Download the artifact for the full Playwright HTML report

## The Workflow File
See `.github/workflows/qa.yml` at the repo root.
It runs Tutorial 01–04 tests on every push to main or pull request.

## How to Trigger It
```bash
git push origin main
```
Then open your repo on GitHub → Actions tab → watch it run.
```

- [ ] **Step 2: Create `.github/workflows/qa.yml`**

```yaml
name: QA Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Tutorial 01 — Anatomy of a Test
        run: npm run test:01

      - name: Tutorial 02 — Page Testing
        run: npm run test:02

      - name: Tutorial 03 — Form and Flow Testing
        run: npm run test:03

      - name: Tutorial 04 — API Testing
        run: npm run test:04

      - name: Upload Playwright Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-reports-${{ github.run_id }}
          path: |
            01-anatomy-of-a-test/playwright-report/
            02-page-testing/playwright-report/
            03-form-and-flow-testing/playwright-report/
            04-api-testing/playwright-report/
          retention-days: 30
```

- [ ] **Step 3: Create `07-ci-pipeline/prompts/spec.md`**

```markdown
# CI Pipeline Spec

## Goal
Run the QA curriculum tests automatically on every push to main or pull request.

## Trigger
- Push to: main, develop
- Pull request to: main

## Steps Required
1. Checkout code
2. Set up Node.js 20 with npm cache
3. npm ci (clean install)
4. Install Playwright chromium (with system deps for Linux)
5. Run tutorials 01, 02, 03, 04 tests
6. Upload all playwright-report/ folders as a single artifact (always, even on failure)

## Notes for Claude
Use `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`.
Use `if: always()` on the upload step so reports are saved even when tests fail.
The `--with-deps` flag on Playwright install is required on ubuntu-latest.
```

- [ ] **Step 4: Commit**

```bash
git add 07-ci-pipeline/ .github/
git commit -m "feat: add tutorial 07 — CI pipeline with GitHub Actions"
```

---

### Task 8: Tutorial 08 — Prompt-Driven Testing

**Files:**
- Create: `08-prompt-driven-testing/README.md`
- Create: `08-prompt-driven-testing/playwright.config.ts`
- Create: `08-prompt-driven-testing/prompts/spec.md`
- Create: `08-prompt-driven-testing/tests/generated.spec.ts`

- [ ] **Step 1: Create `08-prompt-driven-testing/README.md`**

```markdown
# Tutorial 08 — Prompt-Driven Testing

## What You Will Learn
- How to write a test specification in plain English
- How to give that spec to Claude and get working Playwright tests back
- How to review AI-generated tests before running them
- The shift: from writing tests to *specifying* tests

## The Shift

In tutorials 01–07, test code was written by hand (or pre-written for you to study).
From here, you write the specification. Claude writes the code.

Your job as a QA engineer becomes:
1. Understand what needs to be tested
2. Write a clear spec (prompts/spec.md)
3. Give the spec to Claude: "Generate Playwright tests from this spec"
4. Review the output for correctness
5. Run it

## How to Use This Tutorial

1. Open `prompts/spec.md` — read it carefully
2. Give it to Claude with this prompt:
   > "Generate TypeScript Playwright tests from the spec in this file. Target URL is [your URL]."
3. Compare what Claude generates with `tests/generated.spec.ts` (our reference output)
4. Run: `npx playwright test --config=08-prompt-driven-testing/playwright.config.ts`

## Target
A public WooCommerce demo store. Set `TEST_URL` env var to your target.
Default: https://woocommerce.com/customize-checkout/ (may require updating to a live shop URL)

## Running the Tests
```bash
TEST_URL=https://your-woocommerce-shop.com npm run test:08
```
```

- [ ] **Step 2: Create `08-prompt-driven-testing/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

const testUrl = process.env.TEST_URL ?? 'https://woocommerce.com';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: testUrl,
    headless: true,
    screenshot: 'only-on-failure',
  },
  timeout: 30000,
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
```

- [ ] **Step 3: Create `08-prompt-driven-testing/prompts/spec.md`**

```markdown
# Test Spec — WooCommerce Shop Page

## Target
URL: [set TEST_URL env var to your WooCommerce shop URL, e.g. https://yourshop.com/shop/]
Context: Testing as an anonymous (logged-out) visitor.

## Tests Required

### Page Load
1. Shop page loads (status 200, no crash)
2. Page has a visible product grid or product list

### Product Cards
3. At least one product is visible on the page
4. The first product card shows a product name (non-empty text)
5. The first product card shows a price containing a currency symbol ($ or £ or €)

### Navigation
6. Clicking the first product name navigates to a product detail page
7. The product detail page shows the product title (h1) matching the product we clicked

### Cart
8. An "Add to Cart" button is visible on the product detail page

## Assertions
- Use `expect(locator).toBeVisible()` for visibility
- Use `expect(locator).toContainText()` for partial text matching (prices, names)
- Use `page.waitForLoadState('networkidle')` after navigation

## Notes for Claude
Generate TypeScript. Use `page.goto('/')` since baseURL is set in playwright.config.ts.
Use `.first()` to target the first product when multiple exist.
Add `await page.waitForLoadState('networkidle')` after any navigation.
Each test must be independent — always start from the shop page.
```

- [ ] **Step 4: Create `08-prompt-driven-testing/tests/generated.spec.ts`**

```typescript
// This file was generated by Claude from prompts/spec.md.
// It is a reference example — your Claude output may differ slightly.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/shop/');
  await page.waitForLoadState('networkidle');
});

test('shop page loads with a visible product grid', async ({ page }) => {
  // WooCommerce product grids use .products or ul.products
  const grid = page.locator('.products, ul.products');
  await expect(grid.first()).toBeVisible();
});

test('at least one product is visible', async ({ page }) => {
  const products = page.locator('li.product, .type-product');
  const count = await products.count();
  expect(count).toBeGreaterThan(0);
});

test('first product card shows a non-empty name', async ({ page }) => {
  const firstName = page.locator('.woocommerce-loop-product__title').first();
  await expect(firstName).toBeVisible();
  const text = await firstName.textContent();
  expect(text?.trim().length).toBeGreaterThan(0);
});

test('first product card shows a price with currency symbol', async ({ page }) => {
  const price = page.locator('.price').first();
  await expect(price).toBeVisible();
  await expect(price).toContainText(/[$£€]/);
});

test('clicking first product name goes to product detail page', async ({ page }) => {
  const firstName = page.locator('.woocommerce-loop-product__title').first();
  const productName = (await firstName.textContent())?.trim() ?? '';
  await firstName.click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1.product_title')).toContainText(productName);
});

test('product detail page has an Add to Cart button', async ({ page }) => {
  await page.locator('.woocommerce-loop-product__title').first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.single_add_to_cart_button')).toBeVisible();
});
```

- [ ] **Step 5: Add test:08 script to root `package.json`**

Edit `package.json` — add to the `scripts` object:
```json
"test:08": "npx playwright test --config=08-prompt-driven-testing/playwright.config.ts"
```

- [ ] **Step 6: Commit**

```bash
git add 08-prompt-driven-testing/ package.json
git commit -m "feat: add tutorial 08 — prompt-driven testing"
```

---

### Task 9: Tutorial 09 — Agent Harness

**Files:**
- Create: `09-agent-harness/README.md`
- Create: `09-agent-harness/agent/SKILL.md`
- Create: `09-agent-harness/agent/cloud-runner.yml`
- Create: `09-agent-harness/prompts/spec.md`

- [ ] **Step 1: Create `09-agent-harness/README.md`**

```markdown
# Tutorial 09 — Agent Harness

## What You Will Learn
- How to define a Claude Code skill (`/qa`) that runs your QA suite
- How to trigger tests from a cloud runner (GitHub Actions) with a URL and spec file
- The end-to-end loop: write spec → trigger agent → read results

## The Agent Loop

```
You write:  prompts/spec.md  (what to test)
You run:    /qa https://target-url 08-prompt-driven-testing/prompts/spec.md
Claude:     1. Reads the spec
            2. Generates Playwright tests
            3. Runs them
            4. Reports: 6 passed, 0 failed
```

## The Skill File
`agent/SKILL.md` defines the `/qa` command. Copy it to `~/.claude/skills/qa/SKILL.md`
to make `/qa` available in your Claude Code sessions.

## Cloud Execution
`agent/cloud-runner.yml` is a GitHub Actions workflow. You trigger it manually
from the Actions tab with a target URL and spec file path.

No local test runner. Tests run on GitHub's infrastructure.

## How to Use
1. Copy `agent/SKILL.md` to `~/.claude/skills/qa/SKILL.md`
2. In Claude Code, run: `/qa https://your-site.com 08-prompt-driven-testing/prompts/spec.md`
3. Alternatively, trigger `cloud-runner.yml` from GitHub Actions → Run workflow
```

- [ ] **Step 2: Create `09-agent-harness/agent/SKILL.md`**

```markdown
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
```

- [ ] **Step 3: Create `09-agent-harness/agent/cloud-runner.yml`**

```yaml
name: QA Agent — Cloud Run

on:
  workflow_dispatch:
    inputs:
      target_url:
        description: 'URL to test (e.g. https://mysite.com/shop/)'
        required: true
      spec_file:
        description: 'Spec file path (relative to repo root)'
        required: true
        default: '08-prompt-driven-testing/prompts/spec.md'

jobs:
  qa-cloud-run:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run QA agent tests
        env:
          TEST_URL: ${{ inputs.target_url }}
        run: |
          echo "Running QA against: $TEST_URL"
          echo "Using spec: ${{ inputs.spec_file }}"
          TEST_URL=$TEST_URL npx playwright test \
            --config=08-prompt-driven-testing/playwright.config.ts \
            --reporter=list,json

      - name: Upload results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: qa-cloud-results-${{ github.run_id }}
          path: |
            08-prompt-driven-testing/playwright-report/
          retention-days: 7
```

- [ ] **Step 4: Create `09-agent-harness/prompts/spec.md`**

```markdown
# Agent Harness Spec

## What This Tutorial Produces
A reusable /qa Claude Code skill that:
1. Accepts a target URL and a spec file path
2. Generates Playwright tests from the spec
3. Runs them (locally or on GitHub Actions cloud)
4. Reports pass/fail results

## Skill File Location
Copy `agent/SKILL.md` → `~/.claude/skills/qa/SKILL.md`

## Usage Examples

### Local (via Claude Code)
/qa https://mysite.com/shop/ 08-prompt-driven-testing/prompts/spec.md

### Cloud (via GitHub Actions)
Trigger `cloud-runner.yml` with:
- target_url: https://mysite.com/shop/
- spec_file: 08-prompt-driven-testing/prompts/spec.md

## What a Good Agent Run Looks Like
Input:  URL + spec file
Output: "6 passed, 0 failed" or "4 passed, 2 failed — [test names + errors]"
Time:   30–90 seconds for a typical spec
```

- [ ] **Step 5: Commit**

```bash
git add 09-agent-harness/
git commit -m "feat: add tutorial 09 — agent harness"
```

---

### Task 10: Tutorial 10 — Infrastructure QA

**Files:**
- Create: `10-infrastructure-qa/README.md`
- Create: `10-infrastructure-qa/playwright.config.ts`
- Create: `10-infrastructure-qa/prompts/infra-spec.md`
- Create: `10-infrastructure-qa/tests/infra.spec.ts`
- Create: `10-infrastructure-qa/agent/SKILL.md`

- [ ] **Step 1: Create `10-infrastructure-qa/README.md`**

```markdown
# Tutorial 10 — Infrastructure QA

## What You Will Learn
- How to test infrastructure: server reachability, Nginx, API health, SSL, ports
- How to use environment variables to target different servers
- How to extend the agent harness for infra checks
- The full QA loop: deploy → run /qa-infra → get green

## What is Infrastructure QA?

UI tests check what users see. API tests check your application logic.
Infrastructure tests check the layer beneath — is the server up? Is Nginx routing correctly?
Is the SSL cert valid? Is the deployed service responding?

These tests run *after deployment* and before you tell anyone the deployment succeeded.

## The Test Environment Variables

```bash
TARGET_HOST=https://your-server.com   # base URL of the server
API_URL=https://your-server.com/api   # base URL of your API
```

## Running the Tests

```bash
TARGET_HOST=https://your-server.com \
API_URL=https://your-server.com/api \
npx playwright test --config=10-infrastructure-qa/playwright.config.ts
```

## Using the Agent

Copy `agent/SKILL.md` → `~/.claude/skills/qa-infra/SKILL.md`
Then run: `/qa-infra https://your-server.com https://your-server.com/api`
```

- [ ] **Step 2: Create `10-infrastructure-qa/playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

const targetHost = process.env.TARGET_HOST ?? 'http://localhost';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: targetHost,
    headless: true,
    ignoreHTTPSErrors: false,
  },
  timeout: 30000,
  reporter: [['html', { outputFolder: './playwright-report', open: 'never' }], ['list']],
});
```

- [ ] **Step 3: Create `10-infrastructure-qa/prompts/infra-spec.md`**

```markdown
# Infrastructure QA Spec

## Target
SERVER: [set TARGET_HOST env var — e.g. https://your-server.com]
API:    [set API_URL env var   — e.g. https://your-server.com/api]

## Environment Variables
```bash
export TARGET_HOST=https://your-server.com
export API_URL=https://your-server.com/api
```

## Tests Required

### Reachability
1. Server responds to an HTTP GET (status is 2xx or 3xx — not 5xx or timeout)
2. HTTP request redirects to HTTPS (response URL starts with https://)

### Nginx
3. Response headers include a `server` header containing "nginx"

### API Health
4. GET /api/health returns 200
5. GET /api/health response body has a `status` field equal to "ok"

### SSL / HTTPS
6. HTTPS request to the server succeeds without certificate error
7. SSL certificate is not expired (connection does not fail with cert error)

### CORS
8. GET /api/health with `Origin: https://trusted.com` header returns an `access-control-allow-origin` header

## Notes for Claude
Use `process.env.TARGET_HOST` and `process.env.API_URL` for URLs — never hardcode.
Use `request` context (not browser) for API and header checks.
Use `page` for redirect and HTTPS checks.
Use `ignoreHTTPSErrors: false` (default) so expired SSL cert tests fail correctly.
```

- [ ] **Step 4: Create `10-infrastructure-qa/tests/infra.spec.ts`**

```typescript
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
```

- [ ] **Step 5: Create `10-infrastructure-qa/agent/SKILL.md`**

```markdown
---
name: qa-infra
description: Run infrastructure QA checks against a deployed server. Usage: /qa-infra [target-host] [api-url]
---

# Infrastructure QA Agent

You are an infrastructure QA agent. Run after every deployment.

## Inputs
- `$1` — Target host URL (e.g., https://myserver.com)
- `$2` — API base URL (e.g., https://myserver.com/api)

## Steps

### 1. Set environment variables
```bash
export TARGET_HOST=$1
export API_URL=$2
```

### 2. Run infrastructure tests
```bash
TARGET_HOST=$1 API_URL=$2 \
npx playwright test --config=10-infrastructure-qa/playwright.config.ts
```

### 3. Report results
Summarize:
- Server reachable: pass/fail
- HTTPS redirect: pass/fail
- Nginx header: pass/fail
- API health: pass/fail
- SSL: pass/fail
- CORS: pass/fail

If any fail: list the failing check + the error.

### 4. Deployment decision
- All pass → "Deployment validated. Server is healthy."
- Any fail → "Deployment has issues. Do not promote to production until fixed."
  List each failed check.
```

- [ ] **Step 6: Add test:10 script to root `package.json`**

Edit `package.json` — add to `scripts`:
```json
"test:10": "npx playwright test --config=10-infrastructure-qa/playwright.config.ts"
```

- [ ] **Step 7: Commit**

```bash
git add 10-infrastructure-qa/ package.json
git commit -m "feat: add tutorial 10 — infrastructure QA"
```

---

## Self-Review

**Spec coverage check:**
- ✓ 10 tutorial folders, each self-contained
- ✓ README in every tutorial (concept + how to run)
- ✓ demo/ targets in 01–06
- ✓ tests/ harnesses in 01–06, 08, 10
- ✓ prompts/ specs in all 10
- ✓ agent/ skills in 09 and 10
- ✓ GitHub Actions workflow in 07

**No placeholders:** All code is complete and runnable. Server ports are distinct (3001, 3002, 3003) to avoid conflicts. Auth token is consistent within each tutorial.

**Type consistency:** `{ id: number }` and `{ name: string }` inline types used consistently in filter callbacks across tutorials 04–06.
