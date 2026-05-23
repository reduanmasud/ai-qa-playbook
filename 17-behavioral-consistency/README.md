# Tutorial 17: Behavioral Consistency Testing

## What you will learn

AI outputs are non-deterministic.  Asking the same question twice — or rephrasing it — can produce different surface text while still conveying the same meaning.  This tutorial teaches you to test for **consistency** rather than exact string equality.

---

## Why deterministic assertions fail for AI

Classical software testing uses exact assertions:

```typescript
expect(result).toBe('The capital of France is Paris.');
```

This breaks for AI systems because:

1. **Temperature & sampling** — Language models sample from a probability distribution at each token.  Even with the same prompt, outputs vary between calls.
2. **Prompt sensitivity** — "What is the capital of France?" and "Name France's capital city" should be semantically equivalent, but an exact-match assertion written for one will fail for the other.
3. **Model updates** — When you upgrade your LLM provider, exact strings change even if quality improves.

The solution is to test **properties** of the output rather than the output itself:

```typescript
// Instead of this:
expect(answer).toBe('The capital of France is Paris.');

// Test this:
expect(answer.toLowerCase()).toContain('paris');
expect(label).toBe('geography');
```

---

## The pass@k and pass^k reliability metrics

### pass@k

`pass@k` asks: "out of k independent attempts, does at least one succeed?"  For AI quality this is usually softened to: "does at least k-1 out of k attempts meet the threshold?"

In this tutorial we use:
- **k = 5** attempts
- **threshold = 80%** (4 out of 5 must return the same label)

```typescript
const result = passAtK(labels, 0.8);
expect(result.passed).toBe(true);
```

This tolerates one outlier per batch — appropriate for systems with slight sampling variance.

### pass^k (strict pass)

`pass^k` (pass-to-the-k) asks: "do ALL k attempts succeed?"  This is a stricter guarantee used when consistency is contractual — for example, a classification system that gates downstream logic.

```typescript
// All 5 must return "geography"
expect(labels.every(l => l === 'geography')).toBe(true);
```

Use `pass^k` for labels and categories (which should be fully deterministic), and `pass@k` for free-text answers (which may vary in wording).

---

## Semantic equivalence vs. string equality

| Approach | What it checks | When to use |
|---|---|---|
| **String equality** | `answer === expected` | Deterministic systems; never for LLMs |
| **String containment** | `answer.includes('4')` | Numeric or factual key terms |
| **Regex match** | `/paris/i.test(answer)` | Flexible pattern matching |
| **Label/category** | `label === 'geography'` | Structured output fields |
| **LLM-as-judge** | A second model scores the answer | Open-ended quality assessment |

The hierarchy from most to least precise:

```
string equality → containment → regex → label → LLM judge
```

Prefer the most precise assertion that does not create brittle tests.

---

## How to build a rephrase test set

A **rephrase set** is a collection of semantically equivalent questions used to test label or semantic consistency.  Building one:

1. **Start with a canonical question** — the clearest phrasing.
2. **Generate variants systematically**:
   - Swap word order ("capital of France" → "France's capital")
   - Change question type (what/which/tell me/name)
   - Add or remove articles and prepositions
   - Use synonyms ("city" → "metropolis", "define" → "explain")
3. **Include edge cases**: very short questions, questions with typos, questions missing the subject.
4. **Test the rephrase set itself**: verify by hand that every variant truly means the same thing before automating.

Typical rephrase set size: **5–10 variants** per concept.  More variants give higher confidence; fewer reduce test maintenance cost.

---

## The 80% consistency rule of thumb

Why 80% (4 out of 5)?

- Perfect 100% consistency is unrealistic for non-deterministic systems in production.
- Below 80% indicates a systemic problem: the model is not reliably classifying or the topic boundaries are unclear.
- 80% is a pragmatic threshold that tolerates rare sampling outliers without hiding real regressions.

Adjust the threshold based on your system's SLA:
- **Mission-critical classification** (medical, legal): raise to 95%+
- **Exploratory features**: 70% may be acceptable
- **Stable, low-temperature deployments**: 95%+ is achievable

---

## Property-based testing applied to AI outputs

Property-based testing (popularized by QuickCheck and fast-check) generates many random inputs and asserts that invariant *properties* hold for all of them.  The same mindset applies to AI testing:

**Invariant properties to test:**

| Property | Example assertion |
|---|---|
| Label stability | `label` is always one of the known categories |
| No empty answers | `answer.length > 0` for any recognized question |
| Bounded length | `answer.length < 1000` (no runaway outputs) |
| Key term presence | Math answers always mention the numeric result |
| No profanity | `containsBlacklist(answer) === false` |

Instead of testing one specific input/output pair, you test that these properties hold across a wide variety of inputs.  This is robust to surface-level output variation.

---

## Project structure

```
17-behavioral-consistency/
├── demo/
│   └── server.js              # Express server on port 3017 (mock AI)
├── tests/
│   ├── consistency.spec.ts    # All 11 test cases
│   └── helpers/
│       └── consistency.ts     # Utility functions
├── prompts/
│   └── spec.md                # Plain-English specification
├── playwright.config.ts
└── README.md
```

---

## Running the tests

```bash
# From the repo root
npx playwright test --config=17-behavioral-consistency/playwright.config.ts

# Or from this directory
npx playwright test
```

The server starts automatically on port 3017 via the `webServer` config.

---

## Key files

### `demo/server.js`

The mock AI engine.  Key behaviours:
- `classify(question)` — maps questions to `{ label, baseAnswer }` using keyword matching
- `varyAnswer(base, seed)` — applies seed-based surface variation to simulate temperature
- `/answer` — single question endpoint, accepts optional `seed`
- `/batch-answer` — multi-question endpoint, uses index as seed for variety

### `tests/helpers/consistency.ts`

Reusable statistical helpers:
- `computeConsistencyRate(answers)` — fraction of answers matching the mode
- `detectContradiction(a, b)` — flags when two opposite questions both get "yes"
- `semanticContains(answer, expected)` — case-insensitive substring check
- `passAtK(values, threshold)` — pass@k metric with configurable threshold

### `tests/consistency.spec.ts`

Eleven tests covering:
1. Label consistency across 5 rephrasings
2. Answer stability with fixed seed
3. Semantic equivalence for math ("contains 4")
4. Category consistency for programming questions
5. pass@k metric (80% threshold, k=5)
6. Contradiction detection
7. Batch endpoint label consistency
8–9. Input validation (400 errors)
10–11. Helper function unit tests (in-process, no HTTP)
