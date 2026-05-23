# Tutorial 11 — LLM-as-Judge

## What You Will Learn

- Why exact-match assertions fail for AI-generated outputs
- The three levels of output evaluation and when to use each
- How to structure a two-step test: generate output, then judge it
- How to write quality-threshold assertions instead of equality checks
- How meta-evaluation works (judging the judge)
- How this pattern connects to production evaluation frameworks

---

## The Problem with Exact-Match Assertions

Traditional tests compare an actual value to an expected value:

```typescript
expect(result).toBe('The cat sat on the mat.');
```

This works perfectly when outputs are deterministic — a sort function always produces
the same array, a date formatter always returns the same string for the same input.

AI-generated outputs are not deterministic. Two correct summaries of the same article
look nothing alike:

- "AI is changing software testing by making evaluation probabilistic."
- "Software testing has been transformed by large language models, requiring new QA approaches."

Both are correct. Neither matches the other. An exact-match assertion would fail one of
them — or require you to enumerate every acceptable answer, which is impossible at scale.

---

## The Three Levels of Output Evaluation

### Level 1 — Deterministic (exact match, regex, schema)

Use when output structure is fixed and values are predictable.

```typescript
// Good for: status codes, IDs, timestamps, JSON schemas
expect(response.status()).toBe(200);
expect(body).toMatchObject({ id: expect.any(Number) });
```

### Level 2 — Heuristic (length, presence, format)

Use when exact content varies but structural properties hold.

```typescript
// Good for: "summary exists", "response is non-empty", "contains a number"
expect(summary.length).toBeGreaterThan(0);
expect(summary.length).toBeLessThan(200);
expect(summary).toMatch(/\d{4}/); // contains a year
```

### Level 3 — LLM-as-Judge (semantic quality, rubric scoring)

Use when quality is semantic and cannot be captured by structure alone.

```typescript
// Good for: "is this a good summary?", "does this answer the question?"
const { score } = await judgeOutput(summary, 'Is this concise and accurate?');
expect(score).toBeGreaterThanOrEqual(3);
```

**Rule of thumb:** reach for Level 3 only when Levels 1 and 2 cannot capture the
quality dimension you care about. LLM evaluation adds latency and cost.

---

## How LLM-as-Judge Works

The pattern has three actors:

```
[System Under Test]  →  output  →  [LLM Judge]  →  score + reasoning
       ↑                                                      ↓
   test sends                                         test asserts
   a prompt                                           score >= threshold
```

1. **System Under Test** — the AI feature you are testing (a summarizer, a chatbot,
   a code generator). It produces non-deterministic text.

2. **LLM Judge** — a second model (or mock, in this tutorial) that receives the output
   and a rubric, then returns a numeric score and an explanation.

3. **Test** — calls both, then asserts a quality threshold, not an exact value.

The judge is given a **criteria string** — a plain-English rubric describing what
"good" means for this use case. Examples:

- "Is the summary concise (under 100 words)? Does it capture key points?"
- "Does the answer directly address the user's question without hallucinating?"
- "Is the generated code syntactically valid and idiomatic?"

---

## The Demo in This Tutorial

`demo/server.js` provides two endpoints:

| Endpoint | Role |
|---|---|
| `POST /summarize` | The system under test — a mock AI summarizer |
| `POST /evaluate` | The LLM judge — scores any text against a criteria string |

The judge in this tutorial uses simple heuristics (length, punctuation, word
repetition) to produce a score from 1 to 5. In a production system, this endpoint
would call an actual LLM with a rubric prompt like:

```
You are an evaluation assistant. Score the following output on a scale of 1-5
against these criteria: {criteria}

Output: {output}

Return JSON: { "score": <number>, "reasoning": "<explanation>" }
```

---

## Test Patterns Demonstrated

### Quality threshold (not equality)

```typescript
// WRONG for AI outputs
expect(score).toBe(4);

// CORRECT — threshold assertion
expect(score).toBeGreaterThanOrEqual(3);
```

### Two-step judge test

```typescript
const { summary } = await summarize(longArticle);
const { score, reasoning } = await judge(summary, myCriteria);
expect(score).toBeGreaterThanOrEqual(3);
```

### Negative case — bad input scores low

```typescript
const { score } = await judge('', criteria);
expect(score).toBeLessThanOrEqual(2);
```

### Meta-evaluation — judging the judge

```typescript
const { reasoning: firstReasoning } = await judge(someText, criteria);
const { score: metaScore } = await judge(firstReasoning, 'Is this reasoning coherent?');
expect(metaScore).toBeGreaterThanOrEqual(3);
```

Meta-evaluation is used in production to detect judge hallucination — cases where
the judge produces a score but its reasoning is incoherent or contradictory.

---

## Connection to Production Frameworks

This tutorial implements the pattern by hand. Production teams use higher-level
frameworks that wrap and standardise it:

| Framework | What it adds |
|---|---|
| **DeepEval** | Pre-built metrics: answer relevancy, faithfulness, contextual recall, hallucination detection |
| **Giskard** | Red-teaming, bias scanning, regression suites for LLM applications |
| **RAGAS** | RAG-specific metrics: context precision, context recall, answer correctness |
| **OpenAI Evals** | Eval harness for GPT-based systems, supports LLM-as-Judge graders |

All of them build on the same core idea: route AI output to a second model, get back
a score, assert a threshold. Understanding this tutorial means you understand the
foundation of all of them.

---

## Running the Tests

```bash
npm run test:11
```

Playwright starts the demo server automatically, runs all eight tests, then shuts the
server down. No manual setup required.

To run with the HTML report:

```bash
npx playwright test --config=11-llm-as-judge/playwright.config.ts --reporter=html
```

---

## What You Understand After This Tutorial

- The fundamental mismatch between deterministic assertions and AI outputs
- How to model evaluation as a two-step pipeline: generate then judge
- How to write tests that validate quality without knowing exact outputs in advance
- Why `toBeGreaterThanOrEqual(3)` is more meaningful than `toBe(4)` for LLM outputs
- How to validate negative cases (bad outputs should score low)
- What meta-evaluation is and why it matters for judge reliability
- The vocabulary (rubric, criteria, score, reasoning, threshold) used by professional
  AI evaluation frameworks
