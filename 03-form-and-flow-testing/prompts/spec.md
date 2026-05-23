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
