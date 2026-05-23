# Tutorial 22 — RAG Evaluation: Plain-English Specification

## What is a RAG system?

A Retrieval-Augmented Generation (RAG) system answers questions in two stages:

1. **Retrieval stage** — Given a question, search a knowledge base and fetch the most relevant documents.
2. **Generation stage** — Use a language model to produce an answer that is grounded in (limited to) the fetched documents.

RAG reduces hallucination because the model is explicitly told "only answer from these documents." But RAG can still fail in two distinct ways, which is why testing each stage independently matters.

---

## The Two Failure Modes

| Failure | Stage | What went wrong |
|---------|-------|-----------------|
| Wrong docs retrieved | Retrieval | The retriever fetched unrelated documents |
| Unfaithful answer | Generation | The model added facts not in the retrieved docs |

Testing RAG means catching both failure modes.

---

## RAGAS Metrics (the four metrics we measure)

RAGAS (RAG Assessment) is an evaluation framework. Each metric is a score from 0 to 1 (higher = better).

### 1. `contextPrecision`
**Question:** Of the documents I retrieved, how many are actually relevant to the question?

- Score 1.0 → every retrieved document is relevant.
- Score 0.5 → half the retrieved documents are relevant.
- Score 0.0 → none of the retrieved documents are relevant.

### 2. `contextRecall`
**Question:** Of the information needed to fully answer the question, how much is covered by my retrieved documents?

- Measured against a ground-truth answer.
- Score 1.0 → the retrieved docs contain all the information needed.
- Score 0.0 → the retrieved docs contain none of the needed information.

### 3. `faithfulness`
**Question:** Does the generated answer stay within what was retrieved? (No hallucination?)

- Score 1.0 → every claim in the answer is supported by the retrieved docs.
- Score 0.0 → the answer contradicts or invents information not in the docs.

### 4. `answerRelevance`
**Question:** How relevant is the generated answer to the original question?

- Score 1.0 → the answer directly addresses the question.
- Score 0.0 → the answer is completely off-topic.

---

## What the demo server does

### `GET /rag/documents`
Returns all 5 hardcoded documents. Topics: JavaScript, Python, SQL, HTML, CSS.

### `POST /rag/query`
Input: `{ question: string }`
Output:
- `answer` — a sentence or two synthesised from retrieved document content.
- `retrievedDocs` — array of `{ id, content, relevanceScore }`, sorted by relevanceScore descending, top 2 only.
- `contextUsed` — array of document IDs used when forming the answer.

Retrieval algorithm: keyword overlap. Tokenise the question, count how many tokens appear in each document's keywords or body, normalise by the number of question tokens.

### `POST /rag/evaluate`
Input: `{ question, answer, retrievedDocs, groundTruth? }`
Output: `{ contextPrecision, contextRecall, faithfulness, answerRelevance }`

All four metrics are heuristic approximations of the real RAGAS metrics. In production you would call the actual RAGAS library or LlamaIndex evaluators.

---

## What the tests verify

| Test | Metric / Behaviour | Assertion |
|------|--------------------|-----------|
| Retrieval precision | JS question → JS doc | `js-001` is in retrieved IDs |
| Retrieval recall | Broad web question | At least one of `html-001`, `css-001` retrieved |
| Score ordering | Relevance scores | Descending order guaranteed |
| Faithfulness check | Grounded answer | `faithfulness >= 0.5` |
| Context usage | `contextUsed` field | Non-empty array of doc IDs |
| Metric range | All four metrics | Each value in `[0, 1]` |
| High faithfulness | Focused SQL query | `faithfulness >= 0.7` |
| Low relevance | Cooking question | `answerRelevance < 0.4` |
| Fixture pipeline | All 3 test cases | Expected doc IDs present; all metrics valid; `contextRecall > 0` |
| Document store | `GET /rag/documents` | 5 documents, all expected IDs |

---

## Golden test cases for RAG regression

A "golden test case" for RAG contains:
- The input question.
- The set of document IDs that should be retrieved (expected retrieval).
- A ground-truth answer string (for contextRecall calculation).

The fixture file `tests/fixtures/rag-test-cases.json` is this project's golden dataset. Running the fixture test loop in CI detects regressions in:
- The retrieval algorithm (wrong docs start being fetched).
- The answer generator (answers start omitting key ground-truth information).
- The evaluation heuristics (metric values drift outside acceptable ranges).

---

## Connection to other tutorials

- **Tutorial 13 (Hallucination Detection)** introduced the concept of "grounding." RAG is a structural solution to grounding: you constrain the generation to a retrieved context window.
- **Tutorial 12 (Golden Datasets)** explained how to build regression suites. The `rag-test-cases.json` fixture is exactly that pattern applied to RAG.

---

## Real-world evaluation tools

| Tool | Role |
|------|------|
| [RAGAS](https://docs.ragas.io) | Open-source Python library implementing all four metrics using an LLM-as-judge approach |
| [LlamaIndex Evaluation](https://docs.llamaindex.ai/en/stable/module_guides/evaluating/) | Built-in evaluators for faithfulness, relevance, and context |
| [TruEra / TruLens](https://github.com/truera/trulens) | Tracing and evaluation dashboard for RAG pipelines; integrates with LangChain and LlamaIndex |
| [DeepEval](https://github.com/confident-ai/deepeval) | pytest-style LLM evaluation framework with RAGAS-compatible metrics |

In production, swap the heuristic `/rag/evaluate` endpoint for a call to one of these tools.
