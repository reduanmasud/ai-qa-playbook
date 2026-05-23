# Tutorial 23 — Production Monitoring & CI Eval Pipelines

This is the final tutorial in the QA curriculum.  It shows how to run eval suites
continuously, detect regressions across model versions, and enforce quality gates in CI/CD.
Every concept from tutorials 01–22 converges here.

---

## Quick start

```bash
# From the repo root
npm run test:23
```

The Playwright config starts a local Express server on **port 3023** automatically.

---

## How the 23 tutorials converge

```
01  Anatomy of a test          ─┐
02  Page testing                │  Foundation: Playwright mechanics,
03  Form & flow testing         │  selectors, assertions, async patterns
04  API testing                 │
05  Auth & state                │
06  Data & fixtures            ─┘

07  CI pipeline               ─┐  Infrastructure: running tests in
10  Infrastructure QA          │  automated environments, server spin-up,
                              ─┘  environment variables

08  Prompt-driven testing     ─┐
09  Agent harness              │  AI-specific testing foundations:
11  LLM-as-judge               │  how to test what a model "says"
12  Golden datasets            │  rather than what code "returns"
13  Hallucination detection    │
14  Prompt injection           │
15  Multi-turn testing         │
16  Tool-use validation        │
17  Behavioral consistency     │
18  Agent observability        │
19  Cost & latency testing     │
20  Adversarial red-teaming    │
21  Multi-agent pipeline       │
22  RAG evaluation            ─┘

23  Production monitoring  ◄── YOU ARE HERE
    CI eval pipelines
    Regression gates
```

---

## The complete AI testing pyramid

```
           ┌────────────────────────────────────────────┐
           │  Layer 5: Production CI/CD                  │  ← Tutorial 23
           │  Nightly eval runs, regression gates,       │
           │  model-version diffing, alert routing       │
           ├────────────────────────────────────────────┤
           │  Layer 4: AI Eval Suites                    │  ← Tutorials 11–22
           │  LLM-as-judge, golden datasets,             │
           │  safety scoring, RAG precision/recall       │
           ├────────────────────────────────────────────┤
           │  Layer 3: End-to-End Tests                  │  ← Tutorials 08–10
           │  Prompt-driven flows, agent harness,        │
           │  multi-turn conversations                   │
           ├────────────────────────────────────────────┤
           │  Layer 2: Integration Tests                 │  ← Tutorials 04–07
           │  API contracts, auth flows,                 │
           │  data fixtures                              │
           ├────────────────────────────────────────────┤
           │  Layer 1: Unit Tests                        │  ← Tutorials 01–03
           │  Individual components, assertions,         │
           │  page objects                               │
           └────────────────────────────────────────────┘
```

**Rule of thumb:** Lower layers run on every commit.  Upper layers run on a schedule or before
a model deployment.  Do not skip any layer — they catch different classes of failure.

---

## Nightly eval pipelines

The GitHub Actions workflow in `agent/ci-eval.yml` demonstrates a production nightly eval:

```
schedule: 0 2 * * *          # 02:00 UTC every night
         │
         ▼
npm run test:23              # Playwright eval suite
         │
         ▼
check-regressions.js         # Reads JSON results, computes passRate
         │
    passRate ≥ 0.8?
    ┌────────┴─────────┐
   YES                NO
    │                  │
   CI passes         CI fails
                      │
                   Page on-call, open incident
```

### What to do when your nightly eval fails

1. **Don't ignore it.**  A failing eval is a production signal, not a flaky test.
2. Check the Playwright HTML report (uploaded as a build artifact) for individual check
   failures.
3. Compare against the registered baseline:
   `POST /eval/compare { suiteIdA: "baseline", suiteIdB: "nightly-YYYY-MM-DD" }`
4. Look at `regressions` in the compare output — these are your rollback candidates.
5. If the regression is in `latency_check` or `token_budget_check`, investigate infrastructure
   or prompt changes.
6. If the regression is in `safety_check` or `quality_check`, investigate model drift or
   prompt-injection exposure.
7. Roll back the model version if `regressions.length > 0` and `passRate < 0.9`.
8. Re-run the eval after the rollback to confirm recovery.

---

## Regression gates

A **regression gate** blocks a deployment when eval quality drops below a threshold.

```
┌─────────────┐   run-suite    ┌───────────────┐   passRate < 0.8   ┌─────────────┐
│  New model  │ ────────────►  │  Eval server  │ ─────────────────►  │   CI FAIL   │
│  version    │                │               │                     │   (exit 1)  │
└─────────────┘                └───────────────┘                     └─────────────┘
                                      │
                                 passRate ≥ 0.8
                                      │
                                      ▼
                               ┌─────────────┐
                               │  CI PASS    │
                               │  Deploy OK  │
                               └─────────────┘
```

Tune `PASS_THRESHOLD` in `scripts/check-regressions.js` or via the environment variable
`PASS_THRESHOLD=0.9` to match your production SLOs.

---

## Versioning AI evaluations alongside model versions

Best practice is to treat your eval suite like source code:

| Concern               | Convention                                              |
|-----------------------|---------------------------------------------------------|
| Suite identifier      | `nightly-eval-v1`, `nightly-eval-v2` (semver or date)  |
| Baseline registration | Register after every successful production deployment   |
| Fixture files         | Keep `eval-suite.json` in version control               |
| Results archive       | Upload HTML report as CI artifact; keep 30+ days        |
| Model changelog       | Tag baseline runs with the model version string         |

When a new model version ships:

1. Register the *current* eval result as `baseline-model-X`.
2. Deploy the new model to a shadow environment.
3. Run the eval suite against shadow (`target: shadow-endpoint`).
4. Compare: `{ suiteIdA: "baseline-model-X", suiteIdB: "shadow-model-Y" }`.
5. Promote to production only when `regressions.length === 0`.

---

## Shadow testing

Shadow testing runs two model versions on the same inputs at the same time:

```
Live traffic
     │
     ├──► Model A (current prod)  ──► eval score A
     │
     └──► Model B (candidate)     ──► eval score B
                                        │
                              POST /eval/compare
                                        │
                             { regressions: [], improvements: [...] }
                                        │
                                 Promote B to prod?
```

The `/eval/compare` endpoint models this pattern.  Point `suiteIdA` at the prod run and
`suiteIdB` at the shadow run.  If `regressions` is empty and `improvements` is non-empty,
promote the candidate.

---

## The six-layer agent harness model

```
Layer 0 — Data
  Test fixtures, golden datasets, prompt templates, adversarial examples.
  (Tutorials 06, 12, 14, 22)

Layer 1 — Unit checks
  Single-call assertions: response shape, field types, schema validation.
  (Tutorials 01–04)

Layer 2 — Behavioral checks
  Multi-turn, tool-use, consistency, and hallucination tests.
  (Tutorials 15–17)

Layer 3 — Quality scoring
  LLM-as-judge rubrics, safety scores, RAG precision/recall.
  (Tutorials 11, 13, 22)

Layer 4 — Observability
  Tracing, cost/latency budgets, agent step logging.
  (Tutorials 18–19)

Layer 5 — Production CI/CD
  Nightly eval pipelines, regression gates, baseline diffing, alerting.
  (Tutorial 23)
```

Each layer depends on the layers below it.  You cannot run a meaningful Layer 5 eval without
solid Layer 0 fixtures and Layer 3 quality scorers.

---

## Connecting everything: spec → Claude → tests → CI → monitoring

```
prompts/spec.md               (human-readable requirements)
      │
      ▼ (feed to Claude)
tests/production-monitoring.spec.ts   (Playwright test suite)
      │
      ▼ (npm run test:23)
Playwright runs tests against demo/server.js
      │
      ▼
test-results/results.json     (Playwright JSON report)
playwright-report/            (Playwright HTML report)
      │
      ▼ (scripts/check-regressions.js)
Exit 0 ──► CI passes ──► deploy / promote
Exit 1 ──► CI fails  ──► page on-call, block deploy
      │
      ▼ (nightly via agent/ci-eval.yml)
Historical trend data in /eval/history
Baseline registered in /eval/baseline
Regressions surfaced via /eval/compare
```

This loop closes the feedback cycle: requirements drive tests, tests drive CI, CI drives
production safety, and production telemetry feeds back into requirement refinement.

---

## Files in this tutorial

| Path | Purpose |
|------|---------|
| `demo/server.js` | Express server on port 3023 — eval orchestration API |
| `tests/production-monitoring.spec.ts` | Nine Playwright tests covering all endpoints |
| `tests/fixtures/eval-suite.json` | Suite definition (checks, thresholds) |
| `playwright.config.ts` | Playwright config — starts server, enables JSON reporter |
| `agent/ci-eval.yml` | GitHub Actions nightly eval workflow |
| `scripts/check-regressions.js` | CI gate script — reads JSON results, exits 1 on fail |
| `prompts/spec.md` | Plain-English specification for the entire tutorial |
| `README.md` | This file |
