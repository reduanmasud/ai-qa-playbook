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
