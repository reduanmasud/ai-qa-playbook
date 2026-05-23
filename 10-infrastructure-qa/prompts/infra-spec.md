# Infrastructure QA Spec

## Target
SERVER: [set TARGET_HOST env var — e.g. https://your-server.com]
API:    [set API_URL env var   — e.g. https://your-server.com/api]

## Environment Variables
```bash
export TARGET_HOST=https://your-server.com
export API_URL=https://your-server.com/api
```

## Tests Required

### Reachability
1. Server responds to an HTTP GET (status is 2xx or 3xx — not 5xx or timeout)
2. HTTP request redirects to HTTPS (response URL starts with https://)

### Nginx
3. Response headers include a `server` header containing "nginx"

### API Health
4. GET /api/health returns 200
5. GET /api/health response body has a `status` field equal to "ok"

### SSL / HTTPS
6. HTTPS request to the server succeeds without certificate error
7. SSL certificate is not expired (connection does not fail with cert error)

### CORS
8. GET /api/health with `Origin: https://trusted.com` header returns an `access-control-allow-origin` header

## Notes for Claude
Use `process.env.TARGET_HOST` and `process.env.API_URL` for URLs — never hardcode.
Use `request` context (not browser) for API and header checks.
Use `page` for redirect and HTTPS checks.
Use `ignoreHTTPSErrors: false` (default) so expired SSL cert tests fail correctly.
