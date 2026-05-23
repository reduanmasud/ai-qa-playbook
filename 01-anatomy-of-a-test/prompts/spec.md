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
