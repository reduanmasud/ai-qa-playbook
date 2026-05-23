# Test Spec — REST API

## Target
Base URL: http://localhost:3001
Server: node 04-api-testing/demo/server.js (start before running tests)

## Endpoints
- GET /items → returns array of { id, name, price }
- POST /items body: { name, price } → returns created item with id, status 201
- DELETE /items/:id → returns 204, or 404 if not found

## Tests Required
1. GET /items returns 200 and a non-empty array with id/name/price fields
2. POST /items with valid body returns 201 and the created item
3. POST /items with missing price returns 400 with an error field
4. DELETE /items/:id removes the item (verify with GET /items after)
5. DELETE /items/99999 returns 404

## Notes for Claude
Use Playwright's `request` fixture — no browser needed.
Use `request.get()`, `request.post()`, `request.delete()`.
Use `expect(response.status()).toBe(N)` for status codes.
Use `await response.json()` to read the body.
