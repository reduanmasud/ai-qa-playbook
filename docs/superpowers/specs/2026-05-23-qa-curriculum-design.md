# QA Curriculum Design
**Date:** 2026-05-23
**Author:** Reduan Masud
**Status:** Approved

---

## Goal

A self-contained, progressive QA learning curriculum for a software test engineer who works with Laravel and WordPress day-to-day, uses Playwright + TypeScript for testing, and wants to graduate to an AI/agent-driven cloud test harness. No Playwright code written by hand — the end state is a Claude Code agent that accepts plain-English test specs and executes them on the cloud.

---

## Approach

Project-driven (Approach B). Every tutorial is a working mini-project that builds toward the final cloud agent harness. Each folder is fully self-contained and can be revisited independently.

---

## Repository Structure

```
qa/
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-23-qa-curriculum-design.md
├── 01-anatomy-of-a-test/
├── 02-page-testing/
├── 03-form-and-flow-testing/
├── 04-api-testing/
├── 05-auth-and-state/
├── 06-data-and-fixtures/
├── 07-ci-pipeline/
├── 08-prompt-driven-testing/
├── 09-agent-harness/
└── 10-infrastructure-qa/
```

### Standard folder layout (01–07)

```
XX-tutorial-name/
├── README.md        ← concept in plain English + what you will learn
├── demo/            ← the thing being tested (small app, mock server, static page)
├── tests/           ← Playwright / API test harness
└── prompts/         ← plain-English specs you give Claude to generate or adapt tests
```

### Extended layout (08–10)

```
XX-tutorial-name/
├── README.md
├── demo/
├── tests/
├── prompts/
└── agent/           ← Claude Code skill config and cloud runner setup
```

---

## Tutorial Progression

### Phase 1 — Foundations (01–03)

| # | Title | Core Concept | Demo Target | Harness |
|---|-------|-------------|-------------|---------|
| 01 | Anatomy of a Test | Arrange / Act / Assert, pass vs fail | Static HTML counter button | Single Playwright test file |
| 02 | Page Testing | Page load, content, nav, 404s | Minimal Laravel/WordPress welcome page | Tests for title, headings, nav links |
| 03 | Form and Flow Testing | Happy path vs error path, user journeys | Laravel login/contact form | Tests for valid input, wrong input, empty fields, redirect |

### Phase 2 — API and State (04–06)

| # | Title | Core Concept | Demo Target | Harness |
|---|-------|-------------|-------------|---------|
| 04 | API Testing | HTTP methods, status codes, response body | Laravel API: GET/POST/DELETE /items | Playwright `request` context (no browser) |
| 05 | Auth and State | Sessions, tokens, reusing auth across tests | Same API with Bearer token auth | Playwright `storageState` — log in once, share session |
| 06 | Data and Fixtures | Test data lifecycle, avoiding test pollution | Laravel API + seeder | Global setup/teardown calling seeder + rollback |

### Phase 3 — Automation and AI (07–09)

| # | Title | Core Concept | Demo Target | Harness |
|---|-------|-------------|-------------|---------|
| 07 | CI Pipeline | CI/CD, GitHub Actions, reading pipeline failures | Tutorial 04 API pushed to GitHub | `.github/workflows/qa.yml` + artifact upload |
| 08 | Prompt-Driven Testing | Writing test specs in plain English, Claude generates the code | WooCommerce product page | `spec.md` → Claude → `tests/` |
| 09 | Agent Harness | Claude Code agent that reads spec + target, runs on cloud, reports back | Any web target | `/qa` skill + agent config + cloud runner |

### Phase 4 — Infrastructure (10)

| # | Title | Core Concept | Demo Target | Harness |
|---|-------|-------------|-------------|---------|
| 10 | Infrastructure QA | Infra checks: reachability, SSH, Nginx, ports, API health post-deploy | Full server provisioning + Nginx + service deploy | Agent from Tutorial 09 extended with infra checks |

---

## Demo Complexity Ladder

| Tutorials | Demo Type |
|-----------|-----------|
| 01–03 | Static HTML or minimal Laravel/WordPress page |
| 04–06 | Small Laravel REST API with a database |
| 07 | Tutorial 04 API in a GitHub repo |
| 08–09 | Real-world WooCommerce page (external URL) |
| 10 | Real or mock server — provision → configure → validate |

---

## Key Design Decisions

**No hand-written Playwright code by the learner.** Tutorials 01–07 include pre-written harnesses to study and understand. Tutorials 08–10 shift the learner to specifying tests in plain English and directing Claude to generate and run them.

**Cloud execution from Tutorial 09 onward.** No local test runner. The agent harness runs on GitHub Actions or a cloud runner. The learner triggers, reads results, iterates on the spec.

**Each folder is independent.** A learner can return to Tutorial 04 months later and run it without needing any other tutorial's state.

**Prompts folder is a first-class artifact.** From Tutorial 01, every folder includes a `prompts/` directory with the plain-English test specifications. This trains the habit of thinking in specs before thinking in code.

---

## Success Criteria

- Learner can describe what a test is, why it exists, and what makes it good (Tutorial 01)
- Learner can trigger a cloud agent with a URL + spec file and get a test report back (Tutorial 09)
- Learner can write an infra QA spec that validates a deployed server end-to-end (Tutorial 10)
- Every tutorial folder is self-contained and re-runnable months after first study
