# Tutorial 19: Cost and Latency Testing — Plain-English Specification

## Purpose

This specification describes the observable behaviour of the Cost and Latency demo API.
A test engineer can use it to understand what each endpoint should do and how the tests
verify that behaviour.

---

## Endpoints

### POST /complete

**What it does**
Accepts a text prompt and returns a mocked AI completion.

**Input**
- `prompt` (string, required) — the text to complete
- `maxTokens` (number, optional, default 1000) — maximum total tokens allowed for this request

**Output on success (HTTP 200)**
```json
{
  "response": "This is the generated text ...",
  "usage": {
    "inputTokens": 12,
    "outputTokens": 8,
    "totalTokens": 20
  },
  "latencyMs": 66
}
```

- `inputTokens` — estimated tokens in the prompt (words × 1.3, truncated to integer)
- `outputTokens` — word count of the response string
- `totalTokens` — inputTokens + outputTokens
- `latencyMs` — simulated processing time: 50ms base + 2ms per output token

**Output on token limit exceeded (HTTP 429)**
```json
{
  "error": "token_limit_exceeded",
  "used": 85,
  "limit": 50
}
```

Returned whenever `totalTokens > maxTokens`.

**Output on bad input (HTTP 400)**
```json
{ "error": "prompt field is required and must be a non-empty string" }
```

---

### POST /batch-complete

**What it does**
Accepts an array of prompts and returns a completion for each one, plus the total cost
of the entire batch.

**Input**
- `prompts` (string[], required) — array of one or more prompts

**Output on success (HTTP 200)**
```json
{
  "completions": [
    {
      "response": "...",
      "usage": { "inputTokens": 5, "outputTokens": 9, "totalTokens": 14 }
    }
  ],
  "totalCost": 0.000028
}
```

- `totalCost` — total tokens across all completions × $0.000002 per token

**Output on bad input (HTTP 400)**
```json
{ "error": "prompts must be a non-empty array of strings" }
```

---

### GET /budget-status

**What it does**
Returns the accumulated token usage for the current server session.

**Output (HTTP 200)**
```json
{
  "tokensUsed": 340,
  "tokensLimit": 10000,
  "costUsd": 0.00068,
  "remainingBudget": 9660
}
```

- `tokensUsed` — total tokens consumed since the server started (or last reset)
- `tokensLimit` — hard ceiling for this session (10 000 tokens)
- `costUsd` — `tokensUsed × 0.000002`
- `remainingBudget` — `tokensLimit - tokensUsed` (never below 0)

---

### POST /reset-budget

**What it does**
Resets the session token counter back to zero.
Intended for test isolation only — not a production endpoint.

**Output (HTTP 200)**
```json
{ "ok": true }
```

---

## Business Rules

1. **Token formula**
   `inputTokens = floor(promptWordCount × 1.3)`
   `outputTokens = responseWordCount`
   `totalTokens  = inputTokens + outputTokens`

2. **Latency formula**
   `latencyMs = 50 + (outputTokens × 2)`

3. **Token limit**
   When `totalTokens > maxTokens`, the request is rejected with HTTP 429.
   The default `maxTokens` is 1000 when the field is omitted.

4. **Cost rate**
   `$0.000002` per token (both input and output count equally).

5. **Session accumulation**
   Every successful call to `/complete` or `/batch-complete` adds its
   `totalTokens` to the running session counter.
   Rejected (429) requests do NOT increment the counter.

6. **Budget ceiling**
   `remainingBudget` is floored at 0 and never goes negative.
   `tokensUsed` never exceeds `tokensLimit` in the response
   (the server clamps it internally, though the mock does not enforce a hard
   stop — that would be a production concern).

---

## What the Tests Check

| # | Test | Key assertion |
|---|------|--------------|
| 1 | Latency SLA | `latencyMs < 500` AND wall-clock < 800ms |
| 2 | Token budget enforcement | Long prompt + `maxTokens=50` → HTTP 429 |
| 3 | Token count accuracy | Counts are positive integers; `total = input + output` |
| 4 | Cost calculation | `totalCost == sumTokens × 0.000002` |
| 5 | Budget accumulates | `tokensUsed` increases after each call |
| 6 | Short prompt is fast | 5-word prompt → `latencyMs < 200` |
| 7 | Efficiency ratio | `outputTokens / inputTokens < 5` |
| 8 | Budget ceiling | After many calls, `remaining + used == limit` |
