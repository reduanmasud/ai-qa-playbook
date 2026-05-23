# Tutorial 22 — RAG Evaluation

## What is RAG?

**Retrieval-Augmented Generation (RAG)** is an architecture that improves LLM answers by first searching a knowledge base for relevant documents, then asking the model to generate a response grounded in only those documents.

Without RAG, a language model relies entirely on what it learned during training. That creates two problems:
1. Knowledge can be stale (the model doesn't know about recent events).
2. The model may confidently hallucinate facts it never learned.

With RAG, the generation step is *constrained*: the model is told "here are the retrieved documents — answer from these and nothing else." This is the same **grounding** principle introduced in Tutorial 13 (Hallucination Detection), but enforced architecturally rather than by prompt instruction alone.

---

## The Four RAGAS Metrics

[RAGAS](https://docs.ragas.io) (RAG Assessment) defines four metrics that each measure a different dimension of RAG quality. All are normalised to `[0, 1]`.

### `contextPrecision`
> Of the documents I retrieved, how many are actually useful for answering this question?

- High score → the retriever is fetching relevant documents.
- Low score → the retriever is polluting the context window with noise.

**Test implication:** For a JavaScript question, the retriever should not return the SQL document.

### `contextRecall`
> Of the information required to give the ground-truth answer, what fraction is present in the retrieved context?

- Measured against a known-correct reference answer.
- High score → the retrieved docs "cover" the ground truth.
- Low score → the retriever missed documents that contained necessary information.

**Test implication:** For a Python list comprehension question, the `py-001` document must be retrieved because it contains the ground-truth information.

### `faithfulness`
> Does the generated answer only contain claims that are supported by the retrieved documents?

- High score → no hallucination; every claim traces back to a retrieved doc.
- Low score → the model invented facts or contradicted the retrieved context.

**Test implication:** For a focused, single-topic query the faithfulness score should be `>= 0.7`.

### `answerRelevance`
> How directly does the generated answer address the original question?

- High score → the answer is on-topic and responsive to what was asked.
- Low score → the answer talks around the question or is off-topic.

**Test implication:** For a question about cooking (no cooking documents in the store), the system should return a low-relevance answer.

---

## Testing Retrieval Independently from Generation

A key insight in RAG testing is that retrieval and generation are separate, testable components.

```
Question → [RETRIEVER] → Retrieved Docs → [GENERATOR] → Answer
              ↑                                ↑
         Test with                       Test with
         contextPrecision +              faithfulness +
         contextRecall                   answerRelevance
```

**Why test them separately?**

If a test fails, knowing *which* stage failed determines the fix:
- Bad retrieval → tune the embedding model, keyword weights, or re-ranking logic.
- Bad generation → tighten the system prompt, add a grounding instruction, or filter the answer post-generation.

Bundling both stages into a single end-to-end test hides this distinction.

---

## Golden Test Cases for RAG Regression

`tests/fixtures/rag-test-cases.json` contains three golden test cases. Each case specifies:

```json
{
  "id": "r001",
  "question": "What is a JavaScript callback?",
  "expectedDocIds": ["js-001"],
  "groundTruth": "A callback is a function passed as argument to another function"
}
```

The fixture loop in `tests/rag.spec.ts` runs every golden case through the full RAG + evaluation pipeline and asserts:
1. The expected document IDs appear in the retrieved results.
2. All four metric values are valid numbers in `[0, 1]`.
3. `contextRecall` is non-zero (the retrieved docs cover the ground truth).

Adding a new test case to the JSON file automatically adds a new regression test — no TypeScript changes required.

---

## Grounding Revisited (from Tutorial 13)

Tutorial 13 tested whether LLM answers stayed within a provided context by analysing the output. RAG makes grounding *structural*:

- The context window is populated by the retriever, not by the user.
- Faithfulness testing verifies the structural constraint held.
- If faithfulness drops in CI, it signals the generation step is leaking outside the retrieved context.

---

## Demo Server API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rag/documents` | GET | Returns all 5 documents in the store |
| `/rag/query` | POST | Retrieval + answer generation |
| `/rag/evaluate` | POST | Mock RAGAS-style metric computation |

### `POST /rag/query`
```json
// Request
{ "question": "What is a JavaScript callback?" }

// Response
{
  "answer": "A callback is a function passed as an argument...",
  "retrievedDocs": [
    { "id": "js-001", "content": "...", "relevanceScore": 0.75 }
  ],
  "contextUsed": ["js-001"]
}
```

### `POST /rag/evaluate`
```json
// Request
{
  "question": "What is a JavaScript callback?",
  "answer": "A callback is a function passed as an argument...",
  "retrievedDocs": [{ "id": "js-001", "content": "...", "relevanceScore": 0.75 }],
  "groundTruth": "A callback is a function passed as argument to another function"
}

// Response
{
  "contextPrecision": 0.8500,
  "contextRecall": 0.7143,
  "faithfulness": 0.8200,
  "answerRelevance": 0.6300
}
```

---

## Running the Tests

```bash
# From the repo root
npm run test:22

# Or directly from this folder
npx playwright test --config=playwright.config.ts
```

The `webServer` configuration in `playwright.config.ts` automatically starts `demo/server.js` on port `3022` before running the tests and shuts it down afterwards.

---

## Connection to Real-World Tools

| Tool | What it provides |
|------|-----------------|
| [RAGAS](https://docs.ragas.io) | Production-grade Python implementation of all four metrics using an LLM as judge |
| [LlamaIndex Evaluation](https://docs.llamaindex.ai/en/stable/module_guides/evaluating/) | Faithfulness and relevance evaluators integrated directly into LlamaIndex RAG pipelines |
| [TruLens](https://github.com/truera/trulens) | Tracing dashboard + RAGAS-compatible metrics for LangChain / LlamaIndex |
| [DeepEval](https://github.com/confident-ai/deepeval) | pytest-style evaluation framework with contextual precision, recall, and faithfulness tests |

The heuristics in this tutorial's `/rag/evaluate` endpoint approximate real RAGAS metrics without requiring a live LLM judge. In production, replace the heuristic implementation with a call to one of the tools above.
