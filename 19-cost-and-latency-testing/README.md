# Tutorial 19: Cost and Latency Testing

## Overview

AI API calls cost real money and take measurable time. A single call to GPT-4 or Claude
Opus can consume thousands of tokens. An agent that loops, retries unnecessarily, or
generates bloated output can burn through a budget in seconds. This tutorial teaches you
to write tests that enforce token budgets, verify latency SLAs, and catch runaway agents
before they reach production.

---

## Why Cost and Latency Testing Is a First-Class Concern

Traditional software is billed by infrastructure (servers, bandwidth). AI systems add a
third dimension: **token cost**. Token consumption is proportional to both input length
and output length, and both are under the model's indirect control. A poorly prompted
agent or an accidental retry loop can generate 100× more tokens than intended.

Latency matters for a different reason: AI inference is slow compared to database queries
or in-process logic. A user-facing AI feature with no latency SLA can silently degrade
from 300ms to 3 000ms when the model is updated or the prompt grows.

Testing these dimensions gives you:

- **Early warning** when a prompt change bloats token usage
- **Regression detection** when a model update changes output verbosity
- **Budget compliance** proof for internal cost centres or customer SLAs
- **Production readiness** evidence that the system meets latency requirements

---

## Token Budgets

A **token budget** is a per-request or per-session limit on the total number of tokens
consumed (input + output). Setting a budget forces the system to fail fast rather than
silently overspend.

### How to set a budget

Start by profiling your workload:

1. Run 100 representative prompts through the API
2. Record `inputTokens`, `outputTokens`, and `totalTokens` for each
3. Compute p50, p95, and p99 of `totalTokens`
4. Set `maxTokens` to p99 × 1.5 as a safety margin

```typescript
// Example: assert token usage is within 1.5× the expected p99
const P99_EXPECTED = 800;
const BUDGET_CEILING = P99_EXPECTED * 1.5; // 1200 tokens

test('token usage within budget', async ({ request }) => {
  const response = await request.post('/complete', { data: { prompt } });
  const { usage } = await response.json();
  expect(usage.totalTokens).toBeLessThan(BUDGET_CEILING);
});
```

### Input vs output budgets

Input tokens are easier to control (measure the prompt before sending it). Output tokens
depend on the model. When you need strict output control, use the API's `max_tokens`
parameter and test that the server enforces it with a 429 response.

---

## Latency SLA Patterns

A **Service Level Agreement (SLA)** is a contract about response time. For AI systems,
define three percentiles:

| Percentile | Description | Typical target |
|---|---|---|
| p50 | Median response time | < 500ms |
| p95 | 95% of requests | < 1 500ms |
| p99 | 99% of requests | < 3 000ms |

### Measuring latency in tests

Playwright's `APIRequestContext` makes it easy to measure wall-clock latency:

```typescript
test('p50 latency', async ({ request }) => {
  const start = Date.now();
  const response = await request.post('/complete', { data: { prompt } });
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThan(500);
});
```

For statistical accuracy, run the call multiple times and compute percentiles:

```typescript
const times: number[] = [];
for (let i = 0; i < 20; i++) {
  const t0 = Date.now();
  await request.post('/complete', { data: { prompt } });
  times.push(Date.now() - t0);
}
times.sort((a, b) => a - b);

const p95 = times[Math.floor(times.length * 0.95)];
expect(p95).toBeLessThan(1500);
```

### Latency vs reported latency

Always test **both** the server-reported `latencyMs` field and the real wall-clock time.
The server field reflects internal processing (token generation), while wall-clock captures
network + serialisation overhead too. Both should be within SLA.

---

## Detecting Runaway Agents

An agent that loops unnecessarily is the AI equivalent of an infinite loop. Signs:

- `totalTokens` grows with each iteration instead of converging
- `outputTokens / inputTokens` ratio keeps rising
- Budget status shows rapid consumption with no meaningful progress

### Efficiency ratio test

The ratio `outputTokens / inputTokens` for a well-behaved agent should be roughly stable.
A ratio > 5 for short prompts usually means the model is padding or hallucinating structure:

```typescript
test('efficiency ratio stays reasonable', async ({ request }) => {
  const { usage } = (await complete(request, 'Define recursion.')).body;
  const ratio = usage.outputTokens / usage.inputTokens;
  expect(ratio).toBeLessThan(5);
});
```

### Budget accumulation test

Call the agent N times and verify the session budget increments predictably:

```typescript
for (let i = 0; i < 5; i++) {
  await complete(request, prompt);
  const { tokensUsed } = await getBudgetStatus(request);
  expect(tokensUsed).toBeGreaterThan(prev);
  prev = tokensUsed;
}
```

If `tokensUsed` jumps by 10× on one call, that call is the runaway — investigate it.

---

## Cost Attribution in Multi-Agent Systems

When several agents collaborate (orchestrator + workers), token costs must be tracked
per agent to find hotspots:

```
Orchestrator:   500 tokens  ($0.001)
Web Search:     200 tokens  ($0.0004)
Summariser:     800 tokens  ($0.0016)   ← hotspot
Code Writer:    300 tokens  ($0.0006)
Total:         1800 tokens  ($0.0036)
```

**Testing strategy:**

1. Tag each request with an `agentId` header or field
2. Aggregate `totalTokens` per `agentId` in your test harness
3. Assert that no single agent consumes more than its allocated share (e.g. < 40%)

```typescript
test('no single agent consumes more than 40% of total tokens', () => {
  const shares = computeAgentShares(callLog);
  for (const [agent, share] of Object.entries(shares)) {
    expect(share).toBeLessThan(0.4);
  }
});
```

---

## Caching Strategies to Reduce Costs

Caching is the highest-leverage cost reduction technique for AI systems.

### Prompt caching (API-level)

Many providers (Anthropic, OpenAI) offer prompt prefix caching. When the same system
prompt is reused across requests, the provider charges a reduced rate (or zero) for the
cached portion.

```typescript
// Anthropic: pass cache_control in the system message
const response = await anthropic.messages.create({
  system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: userMessage }],
});
```

**Test that caching is active** by checking the `cache_read_input_tokens` field:

```typescript
expect(response.usage.cache_read_input_tokens).toBeGreaterThan(0);
```

### Semantic deduplication

Before calling the API, compute an embedding of the new prompt and check if a
semantically similar prompt was answered recently. A cosine similarity > 0.95 is usually
safe to reuse.

### Response memoisation

For deterministic inputs (e.g., the same document + the same extraction prompt), cache
the response by a hash of the inputs:

```typescript
const cacheKey = crypto.createHash('sha256').update(prompt).digest('hex');
const cached = await cache.get(cacheKey);
if (cached) return cached;

const result = await callLLM(prompt);
await cache.set(cacheKey, result, { ttl: 3600 });
return result;
```

**Test the cache hit path** by calling the same prompt twice and asserting the second
call returns in < 10ms (no API round trip).

---

## Running This Tutorial

```bash
# From the repo root
npm run test:19

# From this directory
npx playwright test --config=playwright.config.ts
```

The demo server starts automatically on port 3019. All tests are self-contained and
re-runnable — the `/reset-budget` endpoint ensures each test that needs a clean budget
state calls it first.

---

## File Reference

| File | Purpose |
|---|---|
| `demo/server.js` | Express server with `/complete`, `/batch-complete`, `/budget-status`, `/reset-budget` |
| `tests/cost-latency.spec.ts` | All 8 tests + 6 helper unit tests |
| `tests/helpers/budget.ts` | `estimateTokens`, `calculateCost`, `isWithinSLA` utilities |
| `playwright.config.ts` | Playwright config pointing to port 3019 |
| `prompts/spec.md` | Plain-English specification of server behaviour |
