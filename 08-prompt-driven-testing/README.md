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
Default: https://woocommerce.com (may require updating to a live shop URL)

## Running the Tests
```bash
TEST_URL=https://your-woocommerce-shop.com npm run test:08
```
