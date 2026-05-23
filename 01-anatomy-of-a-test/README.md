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
