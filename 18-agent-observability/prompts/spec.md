# Tutorial 18: Agent Observability and Tracing — Plain-English Spec

## Overview

This tutorial covers **testing the observability layer of an AI agent**. Instead of only
asserting on the agent's final output, we assert on the structured telemetry the agent emits:
spans, timing data, attributes, and error capture.

---

## Server Behaviour

### `POST /agent/run`

- Accepts a JSON body `{ task: string }`.
- Runs a three-step mock agent pipeline:
  1. **agent.plan** — planning phase (decides how to approach the task).
  2. **agent.tool_call** — executes a tool (e.g. web search).
  3. **agent.synthesize** — produces the final answer.
- Stores the resulting trace in memory.
- Returns `{ result: string, traceId: string }`.

### `POST /agent/run-with-error`

- Same as `/agent/run` but the **agent.tool_call** span always fails.
- The failed span has `status: "error"` and carries `error_code` / `error_message` attributes.
- Still stores and returns a trace so callers can inspect the failure.

### `GET /traces/:traceId`

- Returns the full trace for the given ID:
  ```json
  {
    "traceId": "...",
    "task": "...",
    "spans": [
      {
        "spanId": "...",
        "name": "agent.plan",
        "startTime": 1700000000000,
        "endTime":   1700000000045,
        "durationMs": 45,
        "attributes": { "task": "...", "model": "..." },
        "status": "ok"
      },
      ...
    ],
    "totalDurationMs": 120,
    "createdAt": 1700000000000
  }
  ```

### `GET /traces`

- Returns a summary list of the **last 10** traces, newest first:
  ```json
  {
    "traces": [
      { "traceId": "...", "task": "...", "totalDurationMs": 120, "createdAt": ..., "spanCount": 3 }
    ]
  }
  ```

---

## Test Expectations

### 1 — Trace is emitted
- Run a task via `POST /agent/run`.
- Assert the response includes a `traceId` that is a non-empty string.

### 2 — Trace has all expected spans
- Fetch the trace by `traceId`.
- Assert `spans` contains entries named `agent.plan`, `agent.tool_call`, and `agent.synthesize`.

### 3 — Span timing is valid
- For every span: `startTime < endTime` and `durationMs > 0`.
- `durationMs` must equal `endTime - startTime` (within 1 ms rounding tolerance).

### 4 — Total duration equals sum of span durations
- `totalDurationMs` must equal the sum of all span `durationMs` values (within 5 ms tolerance
  for inter-span scheduling overhead).

### 5 — Error span is captured
- Run `POST /agent/run-with-error`.
- Fetch the trace; assert at least one span has `status: "error"`.
- The error span should be `agent.tool_call` and carry `error_code` and `error_message` attributes.

### 6 — Trace attributes are populated
- Every span must have at least one attribute.
- The `agent.plan` span must carry the original `task` string as an attribute.

### 7 — Traces list endpoint works
- After two successful runs, `GET /traces` must return at least 2 entries.
- Each summary must include `traceId`, `task`, `totalDurationMs`, and `spanCount > 0`.

### 8 — No PII in traces
- No span attribute value should match an email address pattern.
- No span attribute value should match a credit-card-like digit sequence.

---

## Out of Scope

- Real LLM calls (everything is mocked).
- Persistent storage (traces live in memory; the server process holds state).
- OpenTelemetry SDK integration (the server implements a simplified equivalent).
