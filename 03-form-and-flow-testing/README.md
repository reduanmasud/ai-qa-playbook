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
