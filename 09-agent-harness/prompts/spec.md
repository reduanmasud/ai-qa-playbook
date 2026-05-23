# Agent Harness Spec

## What This Tutorial Produces
A reusable /qa Claude Code skill that:
1. Accepts a target URL and a spec file path
2. Generates Playwright tests from the spec
3. Runs them (locally or on GitHub Actions cloud)
4. Reports pass/fail results

## Skill File Location
Copy `agent/SKILL.md` → `~/.claude/skills/qa/SKILL.md`

## Usage Examples

### Local (via Claude Code)
/qa https://mysite.com/shop/ 08-prompt-driven-testing/prompts/spec.md

### Cloud (via GitHub Actions)
Trigger `cloud-runner.yml` with:
- target_url: https://mysite.com/shop/
- spec_file: 08-prompt-driven-testing/prompts/spec.md

## What a Good Agent Run Looks Like
Input:  URL + spec file
Output: "6 passed, 0 failed" or "4 passed, 2 failed — [test names + errors]"
Time:   30–90 seconds for a typical spec
