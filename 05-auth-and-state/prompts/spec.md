# Test Spec — Auth and State

## Target
Base URL: http://localhost:3002

## Auth Flow
POST /auth/login body: { username: "admin", password: "password123" }
Response: { token: "..." }
Use token as: Authorization: Bearer <token>

## Tests Required
1. Login returns 200 and a token
2. GET /items with valid token returns 200 and array
3. GET /items with no token returns 401
4. GET /items with wrong token returns 401
5. POST /items with valid token returns 201
6. POST /items without token returns 401

## Notes for Claude
Use `test.beforeAll` to log in once and store the token.
Pass `headers: { Authorization: \`Bearer \${token}\` }` to protected requests.
Do NOT log in inside each individual test.
