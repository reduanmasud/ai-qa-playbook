# Tutorial 10 — Infrastructure QA

## What You Will Learn
- How to test infrastructure: server reachability, Nginx, API health, SSL, ports
- How to use environment variables to target different servers
- How to extend the agent harness for infra checks
- The full QA loop: deploy → run /qa-infra → get green

## What is Infrastructure QA?

UI tests check what users see. API tests check your application logic.
Infrastructure tests check the layer beneath — is the server up? Is Nginx routing correctly?
Is the SSL cert valid? Is the deployed service responding?

These tests run *after deployment* and before you tell anyone the deployment succeeded.

## The Test Environment Variables

```bash
TARGET_HOST=https://your-server.com   # base URL of the server
API_URL=https://your-server.com/api   # base URL of your API
```

## Running the Tests

```bash
TARGET_HOST=https://your-server.com \
API_URL=https://your-server.com/api \
npx playwright test --config=10-infrastructure-qa/playwright.config.ts
```

## Using the Agent

Copy `agent/SKILL.md` → `~/.claude/skills/qa-infra/SKILL.md`
Then run: `/qa-infra https://your-server.com https://your-server.com/api`
