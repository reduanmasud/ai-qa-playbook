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
