# Tutorial 21: Multi-Agent Pipeline Testing — Plain-English Spec

## What this system does

The demo server simulates a 3-agent AI pipeline that generates a research report from a topic string. The pipeline runs three agents in strict sequence:

1. **Planner** — reads the topic, produces a structured plan (list of steps + estimated count)
2. **Researcher** — reads the plan, produces findings (list of insights + source count)
3. **Writer** — reads the findings, produces written content (prose string + word count)

Each agent's output becomes the next agent's input. The pipeline stores results by ID.

---

## Endpoints

### `POST /pipeline/run`
Run all three agents in sequence for a given topic.

**Request body:**
```json
{ "topic": "climate change" }
```

**Success response (200):**
```json
{
  "pipelineId": "uuid-here",
  "stages": [
    {
      "agent": "planner",
      "input": "climate change",
      "output": { "plan": ["Step 1...", "Step 2..."], "estimatedSteps": 2 },
      "durationMs": 0
    },
    {
      "agent": "researcher",
      "input": { "plan": [...], "estimatedSteps": 2 },
      "output": { "findings": ["Finding 1...", "Finding 2..."], "sources": 4 },
      "durationMs": 0
    },
    {
      "agent": "writer",
      "input": { "findings": [...], "sources": 4 },
      "output": { "content": "This report...", "wordCount": 82 },
      "durationMs": 0
    }
  ],
  "finalOutput": "This report..."
}
```

**Error (400):** `{ "error": "topic must not be empty" }` when topic is blank.

---

### `POST /pipeline/run-stage`
Run a single agent in isolation.

**Request body:**
```json
{ "stage": "planner", "input": "machine learning" }
```

Valid stage values: `"planner"`, `"researcher"`, `"writer"`.

**Success response (200):**
```json
{
  "agent": "planner",
  "input": "machine learning",
  "output": { "plan": ["..."], "estimatedSteps": 3 },
  "durationMs": 0
}
```

**Error (400):** Invalid stage name or missing input.
**Error (422):** Input fails agent-level validation (e.g., empty plan array for researcher).

---

### `GET /pipeline/:pipelineId`
Retrieve a previously run pipeline result.

**Success response (200):** Same shape as `/pipeline/run` response.
**Error (404):** Pipeline ID not found.

---

## Agent schemas (interface contracts)

### Planner
- **Input:** `string` (topic)
- **Output:** `{ plan: string[], estimatedSteps: number }`
- **Constraint:** `estimatedSteps === plan.length`, `plan.length >= 1`

### Researcher
- **Input:** `{ plan: string[], estimatedSteps: number }` (planner output)
- **Output:** `{ findings: string[], sources: number }`
- **Constraint:** `findings.length === plan.length`, `sources >= 1`

### Writer
- **Input:** `{ findings: string[], sources: number }` (researcher output)
- **Output:** `{ content: string, wordCount: number }`
- **Constraint:** `wordCount > 0`, `wordCount` must match actual word count of `content`

---

## What the tests must verify

1. Planner in isolation: correct output shape, `estimatedSteps > 0`
2. Researcher in isolation: correct output shape, `sources > 0`
3. Writer in isolation: correct output shape, `wordCount > 0` and consistent
4. Interface contract: planner output feeds into researcher without error
5. Interface contract: researcher output feeds into writer without error
6. Full pipeline: all 3 stages present, valid data, `finalOutput` matches writer content
7. Pipeline ID persistence: fetch by ID returns identical result
8. Stage ordering: stages always in order planner → researcher → writer
9. Error propagation: empty topic → 400 (no partial result returned)
10. Error propagation: bad researcher input → 422 (not silent)
11. Duration sanity: all `durationMs` values are non-negative and under 5 seconds
