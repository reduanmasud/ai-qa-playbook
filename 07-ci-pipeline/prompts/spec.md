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
