# AI QA Playbook

A progressive QA learning curriculum — 23 self-contained tutorials that take you from writing your first Playwright test all the way to building an AI agent that accepts plain-English specs and runs tests in the cloud.

No Playwright code is written by hand. The end state is a Claude Code agent that reads a spec file and executes tests for you.

---

## Who this is for

Software test engineers who:
- Work with Laravel or WordPress day-to-day
- Use Playwright + TypeScript for testing
- Want to graduate to AI-driven and agentic test harnesses

---

## How to use it

Each tutorial is fully self-contained. You can do them in order or jump to any topic independently.

```bash
git clone https://github.com/reduanmasud/ai-qa-playbook.git
cd ai-qa-playbook
npm install
npx playwright install chromium

# Run any tutorial
npm run test:01
npm run test:14
npm run test:23
```

Every tutorial folder has:
- `README.md` — the concept explained in plain English
- `demo/` — the app or server being tested
- `tests/` — a reference test harness to study
- `prompts/` — plain-English specs you can paste into Claude to generate tests

---

## Curriculum

### Phase 1 — Foundations

| # | Tutorial | Core Concept |
|---|----------|-------------|
| 01 | [Anatomy of a Test](01-anatomy-of-a-test/) | Arrange / Act / Assert, pass vs fail |
| 02 | [Page Testing](02-page-testing/) | Page load, content, navigation, 404s |
| 03 | [Form and Flow Testing](03-form-and-flow-testing/) | Happy path vs error path, user journeys |

### Phase 2 — API and State

| # | Tutorial | Core Concept |
|---|----------|-------------|
| 04 | [API Testing](04-api-testing/) | HTTP methods, status codes, response body |
| 05 | [Auth and State](05-auth-and-state/) | Sessions, tokens, reusing auth across tests |
| 06 | [Data and Fixtures](06-data-and-fixtures/) | Test data lifecycle, avoiding test pollution |

### Phase 3 — Automation and AI

| # | Tutorial | Core Concept |
|---|----------|-------------|
| 07 | [CI Pipeline](07-ci-pipeline/) | GitHub Actions, reading pipeline failures |
| 08 | [Prompt-Driven Testing](08-prompt-driven-testing/) | Write a spec in English, Claude generates the tests |
| 09 | [Agent Harness](09-agent-harness/) | Claude Code skill that runs tests end-to-end |

### Phase 4 — Infrastructure

| # | Tutorial | Core Concept |
|---|----------|-------------|
| 10 | [Infrastructure QA](10-infrastructure-qa/) | Server reachability, Nginx, SSL, API health post-deploy |

### Phase 5 — AI and Agentic Testing

| # | Tutorial | Core Concept |
|---|----------|-------------|
| 11 | [LLM-as-Judge](11-llm-as-judge/) | Score AI outputs with a quality judge instead of exact-match |
| 12 | [Golden Datasets](12-golden-datasets/) | Curated test cases for AI regression testing |
| 13 | [Hallucination Detection](13-hallucination-detection/) | Catch when AI invents facts not in the source |
| 14 | [Prompt Injection Testing](14-prompt-injection-testing/) | Test against OWASP LLM Top 10 #1 attack |
| 15 | [Multi-Turn Testing](15-multi-turn-testing/) | Verify chatbots maintain context across conversation turns |
| 16 | [Tool Use Validation](16-tool-use-validation/) | Test agent tool selection and full trajectory |
| 17 | [Behavioral Consistency](17-behavioral-consistency/) | pass@k testing for non-deterministic outputs |
| 18 | [Agent Observability](18-agent-observability/) | Assert on traces and spans, not just final results |
| 19 | [Cost and Latency Testing](19-cost-and-latency-testing/) | Token budgets, SLAs, runaway agent detection |
| 20 | [Adversarial Red Teaming](20-adversarial-red-teaming/) | Structured attack testing with block-rate metrics |
| 21 | [Multi-Agent Pipeline Testing](21-multi-agent-pipeline/) | Contract testing between agents in a pipeline |
| 22 | [RAG Evaluation](22-rag-evaluation/) | RAGAS metrics: retrieval precision, faithfulness, answer relevance |
| 23 | [Production Monitoring](23-production-monitoring/) | Nightly CI eval pipelines and regression gates |

---

## The prompts workflow

Every tutorial includes a `prompts/spec.md` file. The intended workflow from Tutorial 08 onward:

1. Open the spec file for the tutorial
2. Paste it into Claude with your target URL
3. Claude generates the test file
4. You compare it to the reference in `tests/`

This trains the habit of thinking in specs before thinking in code.

---

## Stack

- [Playwright](https://playwright.dev) 1.60+ with TypeScript
- Express.js for demo servers (each tutorial's own port)
- Node 20+
- GitHub Actions for CI (Tutorial 07, Tutorial 23)

---

## Repository structure

```
ai-qa-playbook/
├── 01-anatomy-of-a-test/
│   ├── README.md
│   ├── demo/
│   ├── tests/
│   └── prompts/
├── ...
├── 23-production-monitoring/
│   ├── README.md
│   ├── demo/
│   ├── tests/
│   ├── prompts/
│   └── agent/          ← Claude Code skill + CI workflow
├── package.json         ← npm run test:01 through test:23
└── tsconfig.json
```
