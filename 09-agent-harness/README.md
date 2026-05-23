# Tutorial 09 — Agent Harness

## What You Will Learn
- How to define a Claude Code skill (`/qa`) that runs your QA suite
- How to trigger tests from a cloud runner (GitHub Actions) with a URL and spec file
- The end-to-end loop: write spec → trigger agent → read results

## The Agent Loop

```
You write:  prompts/spec.md  (what to test)
You run:    /qa https://target-url 08-prompt-driven-testing/prompts/spec.md
Claude:     1. Reads the spec
            2. Generates Playwright tests
            3. Runs them
            4. Reports: 6 passed, 0 failed
```

## The Skill File
`agent/SKILL.md` defines the `/qa` command. Copy it to `~/.claude/skills/qa/SKILL.md`
to make `/qa` available in your Claude Code sessions.

## Cloud Execution
`agent/cloud-runner.yml` is a GitHub Actions workflow. You trigger it manually
from the Actions tab with a target URL and spec file path.

No local test runner. Tests run on GitHub's infrastructure.

## How to Use
1. Copy `agent/SKILL.md` to `~/.claude/skills/qa/SKILL.md`
2. In Claude Code, run: `/qa https://your-site.com 08-prompt-driven-testing/prompts/spec.md`
3. Alternatively, trigger `cloud-runner.yml` from GitHub Actions → Run workflow
