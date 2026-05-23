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
