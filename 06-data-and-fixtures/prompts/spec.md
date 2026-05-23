# Test Spec — Data and Fixtures

## Target
Base URL: http://localhost:3003
Auth: Bearer test-bearer-token-xyz

## Reset Endpoint
POST /test/reset — restores database to 3 seed items: Apple, Banana, Cherry

## Tests Required
1. GET /items returns exactly 3 items: Apple, Banana, Cherry (in that order)
2. POST a new item → GET /items shows 4 items
3. DELETE /items/1 → GET /items shows 2 items, Apple is gone
4. A second GET /items still shows 3 items (proving test isolation reset the state)

## Critical Pattern
Call POST /test/reset in `test.beforeEach` so every test starts from the same 3-item baseline.
Without this, test 4 would fail because test 2 added an item.

## Notes for Claude
Use `test.beforeEach` to call the reset endpoint.
Assert array length with `expect(items).toHaveLength(N)`.
Assert item names with `.map(i => i.name)` and `toEqual([...])`.
