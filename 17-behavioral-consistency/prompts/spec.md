# Behavioral Consistency Testing — Plain-English Spec

## What this system does

A mock AI answer service accepts a natural-language question and returns:
- `answer` — a short text response (may vary in wording)
- `label` — the topic category (`geography`, `math`, `programming`, `unknown`)

The system also accepts a batch of questions and returns all answers in one call.

An optional `seed` parameter makes individual responses deterministic for testing.

---

## Behavioural requirements

### 1. Label consistency across rephrasings

When the same question is asked in multiple ways, the `label` field must always be
the same, even if the `answer` wording differs.

Examples of equivalent questions that must all produce `label: "geography"`:
- "What is the capital of France?"
- "What is France's capital city?"
- "Paris is capital of which country?"
- "What capital city does France have?"
- "Tell me the capital city of France."

### 2. Determinism with a fixed seed

When the same question is sent with the same numeric `seed`, the `answer` text must be
identical on every call.  This allows regression tests to pin to specific surface forms.

### 3. Semantic equivalence for math

Questions about "2 + 2" must always return an answer that semantically contains the
value "4", regardless of how the question is phrased:
- "What is 2 + 2?"
- "2 plus 2 equals?"
- "Add two and two"

We test for *semantic content* ("contains 4") rather than an exact string match,
because the wording of AI responses is not guaranteed to be identical.

### 4. Programming category robustness

Any question that is clearly about Python syntax or programming must return
`label: "programming"`, regardless of which aspect of Python is asked about.

### 5. pass@k reliability (80% threshold)

Run the same question k = 5 times without a fixed seed.  At least 80% of calls
(4 out of 5) must return the same `label`.  This tolerates one outlier per batch
and reflects real-world sampling variability.

### 6. No logical contradictions

If one question asserts a true fact ("Is Paris the capital?") and a logically
opposite question asserts a false fact ("Is Berlin the capital of France?"),
the system must not answer both with "yes".  Two affirmative answers to
mutually exclusive claims is a contradiction.

### 7. Batch consistency

`POST /batch-answer` with multiple rephrasings of the same question must return
results where all `label` fields are identical to what individual `/answer` calls
would return.

---

## Error cases

| Scenario | Expected status | Expected behaviour |
|---|---|---|
| `/answer` with no `question` field | 400 | `{ error: "..." }` |
| `/batch-answer` with empty array | 400 | `{ error: "..." }` |
| Unrecognised question | 200 | `label: "unknown"` |

---

## Non-goals

- This spec does NOT require exact string matches on `answer` text.
- This spec does NOT require a real LLM — a mock with deterministic logic is sufficient.
- This spec does NOT cover multi-turn conversation or session state.
