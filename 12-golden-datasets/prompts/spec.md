# Tutorial 12 — Golden Datasets: Plain-English Spec

## What This Tutorial Covers

A **golden dataset** is a curated collection of input-output pairs with known-correct answers. It acts as a regression guard for AI systems: every time the model, prompt, or inference pipeline changes, you re-run the golden set and confirm that outputs still meet quality thresholds.

---

## System Under Test

A text classifier accessible via HTTP API:

- **POST /classify**
  - Request body: `{ "text": "<string>" }`
  - Response body: `{ "label": "positive" | "negative" | "neutral", "confidence": <0–1 float> }`
  - Classification rules:
    - Text containing "happy", "great", or "love" → label `positive`, confidence `0.9`
    - Text containing "bad", "terrible", or "hate" → label `negative`, confidence `0.85`
    - All other text → label `neutral`, confidence `0.6`

- **GET /health**
  - Response body: `{ "status": "ok" }`
  - Used to verify the server is running before tests execute

---

## Golden Dataset (`tests/fixtures/golden.json`)

Each entry represents one curated test case:

| Field            | Type   | Description                                         |
|------------------|--------|-----------------------------------------------------|
| `id`             | string | Unique identifier (e.g. `g001`)                     |
| `input`          | string | The text to classify                                |
| `expectedLabel`  | string | The correct label (`positive`, `negative`, `neutral`)|
| `minConfidence`  | number | Minimum acceptable confidence score (0–1)           |

**Rationale for each case:**
- `g001` — "I love this product!" — clear positive signal via "love"
- `g002` — "This is terrible quality." — clear negative signal via "terrible"
- `g003` — "The package arrived today." — neutral, no sentiment keywords
- `g004` — "Great experience overall!" — positive signal via "great"
- `g005` — "I hate waiting so long." — negative signal via "hate"

---

## Test Requirements

### Individual case tests
- Load the golden dataset from `tests/fixtures/golden.json`
- For each case, send a POST request to `/classify` with the `input` text
- Assert the returned `label` exactly matches `expectedLabel`
- Assert the returned `confidence` is greater than or equal to `minConfidence`
- Each case is an independent test so failures are clearly identified by ID

### Pass-rate gate (80% threshold)
- Run all golden cases and collect results
- Compute the pass rate: `(number of passing cases) / (total cases)`
- If the pass rate is below `0.80` (80%), fail with a detailed report listing which cases failed and why
- This gate tolerates minor regressions without blocking deployment, while catching systemic failures

### Regression detection table
- Run all golden cases and emit a formatted console table showing each case ID, input, expected label, actual label, confidence, and pass/fail status
- This test always passes (it is diagnostic, not gating) — the pass-rate gate is the enforcement mechanism
- Purpose: give engineers at-a-glance visibility into what changed between runs

---

## Acceptance Criteria

1. All 5 individual golden case tests pass against the mock server
2. The pass-rate test reports 100% (5/5) and passes
3. The regression table is printed to stdout with correct data
4. If the server's classifier were changed to break 2+ cases, the pass-rate gate would fail with a descriptive error message
5. Tests are self-contained: the server starts automatically via `webServer` in playwright.config.ts
