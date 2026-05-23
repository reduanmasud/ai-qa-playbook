# Tutorial 13: Hallucination Detection — Plain-English Spec

## What this system does

We have a mock AI question-answering (QA) service that accepts a **context document** and a **question**, then returns an **answer**. The service also exposes a **grounding checker** endpoint that accepts the original context and an answer, and tells us whether every claim in the answer can be traced back to the source.

The QA service is intentionally imperfect: 20% of the time it ignores the context entirely and returns a fabricated statistic ("The study showed 94% success rate") regardless of what the context actually says.

---

## Endpoints

### POST /qa
- **Input**: `{ context: string, question: string }`
- **Output**: `{ answer: string }`
- Behaviour: extracts content words from the question, finds matching sentences in the context, and returns the most relevant ones. 20% of the time returns a fabricated answer.

### POST /check-grounding
- **Input**: `{ context: string, answer: string }`
- **Output**: `{ grounded: boolean, unsupportedClaims: string[] }`
- Behaviour: scans the answer for numeric tokens and distinctive phrases; reports any that do not appear in the context as unsupported claims.

---

## Test requirements

1. **Grounded answer test** — Ask a question whose answer is clearly in the source context. Call `/check-grounding`. Assert `grounded === true` and `unsupportedClaims` is empty.

2. **No inflated numbers test** — Ask about the success rate 5 times. Extract all numbers from every answer. Assert that no number exceeds the highest value documented in the context (91%).

3. **Fabrication detection test** — Send a known fabricated answer ("94% success rate") directly to `/check-grounding`. Assert `grounded === false` and that at least one claim references "94".

4. **Citation extraction test** — Ask a question, extract all numbers from the answer using the `extractNumbers` helper, then assert each number also appears in the source context.

5. **Consistency test** — Ask the same question 3 times. Collect all numeric values from all answers. Assert every number is drawn from the set of numbers present in the source context (contradictory or extra numbers signal hallucination risk).

6. **Helper unit test (checkFactsInContext)** — Provide a mix of real and invented claims. Assert the helper correctly separates them into `supported` and `unsupported` arrays.

7. **Helper unit test (extractNumbers)** — Provide a sentence containing integers, decimals, and percentages. Assert the helper returns the correct numeric array.

---

## Grounding helpers (tests/helpers/grounding.ts)

- `extractNumbers(text: string): number[]` — returns every numeric value (integer, decimal, percentage) found in the text.
- `checkFactsInContext(facts: string[], context: string): { supported: string[], unsupported: string[] }` — for each fact, checks that all significant words appear in the context; partitions into supported vs unsupported.

---

## Out of scope

- Real LLM integration (a real system would call an actual model API)
- Semantic similarity (these checks are lexical; production tools like RAGAS use embeddings)
- UI or browser interaction
