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
