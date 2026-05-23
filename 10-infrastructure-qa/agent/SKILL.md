---
name: qa-infra
description: Run infrastructure QA checks against a deployed server. Usage: /qa-infra [target-host] [api-url]
---

# Infrastructure QA Agent

You are an infrastructure QA agent. Run after every deployment.

## Inputs
- `$1` — Target host URL (e.g., https://myserver.com)
- `$2` — API base URL (e.g., https://myserver.com/api)

## Steps

### 1. Set environment variables
```bash
export TARGET_HOST=$1
export API_URL=$2
```

### 2. Run infrastructure tests
```bash
TARGET_HOST=$1 API_URL=$2 \
npx playwright test --config=10-infrastructure-qa/playwright.config.ts
```

### 3. Report results
Summarize:
- Server reachable: pass/fail
- HTTPS redirect: pass/fail
- Nginx header: pass/fail
- API health: pass/fail
- SSL: pass/fail
- CORS: pass/fail

If any fail: list the failing check + the error.

### 4. Deployment decision
- All pass → "Deployment validated. Server is healthy."
- Any fail → "Deployment has issues. Do not promote to production until fixed."
  List each failed check.
