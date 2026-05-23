# Tutorial 13 — Hallucination Detection

## What is hallucination?

In the context of AI language models, **hallucination** refers to the generation of plausible-sounding but factually incorrect or unsupported content. The model "confabulates" — it produces text that reads fluently yet contradicts or extends beyond its source material.

This is dangerous in production because:

- Users may trust confident-sounding wrong answers (especially for medical, legal, or financial topics).
- Fabricated statistics can propagate through downstream systems.
- The errors are hard to spot without automated checking — the output looks exactly like correct output.

---

## Three types of hallucination

### 1. Intrinsic hallucination
The generated answer **contradicts** the source document.

> Source: "85% of participants improved."
> Answer: "Only 40% of participants showed any benefit."

The answer is directly refuted by the context.

### 2. Extrinsic hallucination
The generated answer **adds information not present** in the source.

> Source: "The treatment ran for 12 weeks."
> Answer: "The treatment ran for 12 weeks and received FDA approval in 2022."

Nothing in the context supports "FDA approval in 2022" — the model invented it.

### 3. Factual hallucination
The generated answer states a **real-world fact incorrectly**, independent of the source document.

> Answer: "Albert Einstein was born in 1889."
> Fact: Einstein was born in 1879.

---

## Key testing technique: Grounding / Faithfulness check

**Grounding** (also called **faithfulness**) asks: *can every claim in the answer be traced back to the source context?*

The test pattern is:
1. Call the QA endpoint with `{ context, question }` → get `answer`.
2. Call the grounding endpoint with `{ context, answer }` → get `{ grounded, unsupportedClaims }`.
3. Assert `grounded === true`. If false, inspect `unsupportedClaims` to understand what was hallucinated.

In this tutorial the grounding check is a mock lexical scanner. In production you would use an LLM-as-judge (e.g. G-Eval) or a dedicated faithfulness scorer.

---

## Citation extraction as a test technique

Numbers are excellent hallucination signals because they are specific and memorable:

```
extractNumbers("85% of patients, 3.2-point reduction") → [85, 3.2]
```

If the answer contains a number that does not appear in the context, that number is almost certainly fabricated. The `extractNumbers` helper in `tests/helpers/grounding.ts` implements this pattern.

Test approach:
1. Extract all numbers from the answer.
2. Extract all numbers from the source context.
3. Assert the answer's number set is a subset of the context's number set.

---

## Consistency as a hallucination signal

If you ask the same question multiple times and receive **contradictory numeric facts**, that is a strong signal that the model is not reliably grounded. A truthful, well-grounded system gives the same facts repeatedly.

Test approach:
1. Ask the same question N times (3 is sufficient for a smoke test).
2. Collect all numeric values from all answers.
3. Assert every value appears in the source context.

---

## Connection to evaluation frameworks

This tutorial demonstrates the core ideas behind two research-grade evaluation frameworks:

### RAGAS (Retrieval-Augmented Generation Assessment)
RAGAS measures four dimensions of RAG pipeline quality:
- **Faithfulness** — the grounding check in this tutorial (are all claims supported by retrieved context?).
- **Answer Relevancy** — does the answer actually address the question?
- **Context Precision** — was the retrieved context relevant to the question?
- **Context Recall** — did retrieval surface all necessary information?

See: https://docs.ragas.io

### HALOGEN (Hallucination Annotation and Generation)
HALOGEN is a benchmark that categorises hallucination types across domains and provides structured annotation guidelines. It distinguishes intrinsic/extrinsic/factual hallucination at the span level, which maps directly to the `unsupportedClaims` array returned by `/check-grounding` in this tutorial.

See: https://arxiv.org/abs/2501.08527

---

## Running the tests

```bash
# From the repo root
npx playwright test --config=13-hallucination-detection/playwright.config.ts

# From inside this folder
npx playwright test
```

The `webServer` block in `playwright.config.ts` starts `demo/server.js` automatically on port 3013 before any test runs.

---

## File structure

```
13-hallucination-detection/
├── demo/
│   └── server.js               # Express mock QA + grounding server (port 3013)
├── tests/
│   ├── helpers/
│   │   └── grounding.ts        # extractNumbers, checkFactsInContext utilities
│   └── hallucination.spec.ts   # All Playwright tests
├── prompts/
│   └── spec.md                 # Plain-English spec for this tutorial
├── playwright.config.ts
└── README.md
```

---

## Key concepts summary

| Concept | What it tests |
|---|---|
| Grounding check | Every claim in the answer is traceable to the source |
| Citation extraction | Numbers in the answer exist verbatim in the context |
| Consistency check | Repeated queries give non-contradictory numeric facts |
| `checkFactsInContext` | Lexical fact-checking of individual claim strings |
| `extractNumbers` | Tokenise numeric values from free text |
