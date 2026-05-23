# Tutorial 23: Production Monitoring & CI Eval Pipelines — Plain-English Spec

## Overview

This tutorial covers the final layer of an AI quality-assurance strategy: running eval suites
continuously in production, detecting regressions when models change, and integrating quality
gates into a CI/CD pipeline so bad model changes never reach users.

---

## The Problem This Solves

AI systems drift over time.  A new model version might be slightly more verbose, score lower on
a quality rubric, or start violating safety policies on edge-case inputs.  Without automated
monitoring these regressions are invisible until a customer complains.

The solution is a **continuous eval pipeline**:

1. Define a suite of automated checks (latency, token budget, safety, quality).
2. Run the suite on a schedule (nightly) against a live or shadow endpoint.
3. Compare results to a stored baseline.
4. Fail the CI job (and block the deployment) if pass rate drops below a threshold.

---

## Server Behaviour (`demo/server.js`)

The demo Express server on port **3023** exposes five endpoints that together implement a
minimal eval orchestration service.

### POST /eval/run-suite

**Input** `{ suiteId: string, target: string }`

The server runs four built-in checks:

| Check ID            | What it measures                    | Passes when            |
|---------------------|-------------------------------------|------------------------|
| `latency_check`     | Simulated API response time         | < 500 ms               |
| `token_budget_check`| Simulated token count               | < 1 000 tokens         |
| `safety_check`      | Content-safety score                | score ≥ 0.8            |
| `quality_check`     | LLM-as-judge quality score          | score ≥ 0.75           |

**Output**

```json
{
  "suiteId": "nightly-eval-v1",
  "target": "https://api.example.com",
  "timestamp": "2026-01-01T02:00:00.000Z",
  "results": [
    { "checkId": "latency_check", "name": "Response latency < 500ms",
      "passed": true, "score": 1.0, "durationMs": 95 }
  ],
  "summary": {
    "total": 4, "passed": 4, "failed": 0,
    "passRate": 1.0, "avgScore": 0.9625
  }
}
```

The result is also stored in an in-memory history ring buffer (last 20 entries).

### GET /eval/history

Returns the last five suite run results, newest first.  Used by dashboards and the compare
endpoint to look up previous runs.

### POST /eval/compare

**Input** `{ suiteIdA: string, suiteIdB: string }`

Compares the most recent run of each suite ID.  Returns three lists of check IDs:

- `regressions` — checks that passed in A but failed in B
- `improvements` — checks that failed in A but passed in B
- `unchanged` — checks with the same pass/fail status in both runs

This powers the "model diff" view in a monitoring dashboard.

### POST /eval/register-baseline

**Input** `{ suiteId: string }`

Designates the most recent run of the given `suiteId` as the current baseline.  Future runs
can be compared against this baseline to detect regressions.

### GET /eval/baseline

Returns the stored baseline suite result, or 404 if none has been registered yet.

---

## Fixture File (`tests/fixtures/eval-suite.json`)

Describes the eval suite definition:

- `suiteId` — unique identifier for this suite version (e.g. `"nightly-eval-v1"`)
- `checks` — list of check definitions with `id`, `name`, and `threshold`

The server uses its own built-in check runners; the fixture is used by the tests to verify
that the server returns results for exactly the expected check IDs.

---

## GitHub Actions Workflow (`agent/ci-eval.yml`)

A workflow that:

1. Triggers nightly at 02:00 UTC and on manual `workflow_dispatch`.
2. Installs dependencies and Playwright browsers.
3. Runs the full eval test suite (`npm run test:23`).
4. Uploads the HTML report as a build artifact.
5. Calls `scripts/check-regressions.js` to enforce the pass-rate gate.

---

## Regression Gate Script (`scripts/check-regressions.js`)

A Node.js script that:

1. Reads the Playwright JSON results file (`test-results/results.json`).
2. Counts passed and total tests.
3. Computes `passRate = passed / total`.
4. Exits **0** (success) when `passRate >= 0.8`.
5. Exits **1** (failure) when `passRate < 0.8`, printing a clear error message.

The `PASS_THRESHOLD` environment variable overrides the default `0.8`.

---

## Test Cases (`tests/production-monitoring.spec.ts`)

| # | Name | What it verifies |
|---|------|-----------------|
| 1 | Eval suite runs and returns summary | POST /eval/run-suite returns all required top-level and summary fields |
| 2 | All checks execute | results array contains all four built-in check IDs |
| 3 | Pass-rate calculation is correct | summary.passRate equals passed/total to four decimal places |
| 4 | History accumulates | Three runs → three entries appear in GET /eval/history |
| 5 | Baseline registration | Register suite, GET /eval/baseline returns the same suiteId |
| 6 | Regression detection | Compare two suites → response has regressions / improvements / unchanged |
| 7 | CI gate behaviour | passRate ≥ 0.8 threshold is computable and the gate would pass |
| 8 | Timestamp format | timestamp is valid ISO 8601 with timezone |
| 9 | Suite ID in results | suiteId echoed back in response and stored in history |

---

## Key Concepts

### Eval Suite vs Integration Test

An integration test checks whether your *code* works correctly.  An eval suite checks whether
your *AI system* behaves within acceptable quality bounds.  Both are necessary.

### Baseline Registration

Before deploying a model change, register the current production run as the baseline.  After
deployment, run the same suite and compare.  Any `regressions` in the diff are candidates for
rollback.

### Pass-Rate Threshold

`0.8` (80%) is a reasonable starting threshold for most production AI systems.  Tune upwards
(e.g. `0.95`) as your eval suite matures and false-positive checks are eliminated.

### Shadow Testing

Run two model versions in parallel on live traffic.  Feed the same inputs to both.  Compare
eval scores.  Roll out the new version only when its scores are equal or better across all
checks.  The `/eval/compare` endpoint models this pattern.
