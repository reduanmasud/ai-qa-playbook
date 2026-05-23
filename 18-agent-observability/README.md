# Tutorial 18: Agent Observability and Tracing

## What is Observability?

The classic "three pillars" of observability are:

| Pillar | What it captures | AI agent example |
|--------|-----------------|-----------------|
| **Logs** | Discrete events with a timestamp and message | `"Tool web_search called with query: climate change"` |
| **Metrics** | Numeric measurements aggregated over time | Average token count per request, error rate per tool |
| **Traces** | Causal chains of work across steps / services | A full agent run as a tree of spans: plan → tool_call → synthesize |

Logs answer *what happened*. Metrics answer *how often / how much*. Traces answer *why it happened and how long each step took*.

---

## Why AI Agents Specifically Need Tracing

Traditional web services are largely deterministic — the same input produces the same output. AI agents are not:

- **Non-deterministic**: Two identical prompts may produce different outputs due to temperature, sampling, or model version drift.
- **Multi-step**: A single user request triggers a chain of internal operations (planning, tool use, reflection, synthesis). Without tracing, a failure looks like a black box.
- **Tool-calling**: Agents invoke external tools (search engines, code interpreters, APIs). Each call is a potential latency spike or failure point.
- **Context-dependent**: Answers depend on conversation history, retrieved documents, or cached state that is invisible in the final output.

Without distributed tracing, debugging a failed agent run means guessing. With tracing, you can pinpoint the exact span where something went wrong.

---

## OpenTelemetry Concepts Applied to AI

[OpenTelemetry (OTel)](https://opentelemetry.io/) is the open standard for collecting traces, metrics, and logs. These concepts map directly to AI agent work:

### Trace
A trace represents a single end-to-end request. It has a globally unique `traceId`. For an agent, a trace = one task execution.

### Span
A span is a single unit of work within a trace. Each span records:

```json
{
  "spanId": "a1b2c3d4",
  "name": "agent.tool_call",
  "startTime": 1700000000100,
  "endTime":   1700000000220,
  "durationMs": 120,
  "attributes": {
    "tool_name": "web_search",
    "tool_input": "search: climate change",
    "cache_hit": false
  },
  "status": "ok"
}
```

The three canonical agent spans are:
- `agent.plan` — the model decides how to approach the task
- `agent.tool_call` — the model invokes an external tool
- `agent.synthesize` — the model composes the final answer

### Attributes
Key-value metadata attached to a span. Good attributes tell you *what the agent was doing*, not just *that it was running*. Examples:
- `model`, `temperature`, `task`
- `tool_name`, `tool_input`, `cache_hit`
- `output_tokens`, `finish_reason`

### Trace Context
In distributed systems, the `traceId` propagates across service boundaries via HTTP headers (`traceparent`). For agents this means a parent span in your API gateway can link to child spans inside the agent runtime.

---

## Testing the Observability Layer Itself

Most QA focuses on the agent's *output*. This tutorial teaches a different skill: **testing that the agent correctly emits telemetry**.

Why test observability?

1. **Silent failures**: An agent can return a plausible-looking answer while skipping tool calls — you will not notice unless you check the trace.
2. **Regression detection**: A model update may change which spans are emitted or drop certain attributes, breaking downstream dashboards.
3. **Compliance**: In regulated industries (finance, healthcare), you may be required to prove that every agent decision is logged.
4. **SLA monitoring**: Alerting on `durationMs` of individual spans lets you detect tool latency degradation before it affects users.

The tests in this tutorial assert on:
- Span names (was every stage executed?)
- Span timing (are measurements internally consistent?)
- Span attributes (does each span carry enough context to debug?)
- Error capture (does a failing tool produce an error span?)
- PII absence (do traces accidentally leak sensitive data?)

---

## How Trace Data Helps Debug Agent Failures in Production

A typical debugging workflow:

1. User reports: "The agent gave a wrong answer for task X".
2. You look up the `traceId` returned to the user (stored in your API response or logs).
3. You fetch the trace from your observability backend.
4. You inspect spans:
   - Did `agent.plan` produce a reasonable plan? (check `steps_identified` attribute)
   - Did `agent.tool_call` succeed? (check `status` and `error_*` attributes)
   - Did `agent.synthesize` receive the tool output? (check `output_tokens`)
5. You replay the failing span in isolation using the captured `tool_input`.

Without a trace, step 4 is impossible. You would only see the final wrong answer.

---

## Connection to Production Observability Platforms

Real-world teams use these platforms to store and query agent traces:

| Platform | Focus | Key features |
|----------|-------|--------------|
| [LangSmith](https://smith.langchain.com/) | LangChain-native tracing | Automatic span capture for LangChain agents, prompt comparison UI |
| [Langfuse](https://langfuse.com/) | Open-source LLM observability | Self-hostable, score annotations, dataset creation from traces |
| [Weights & Biases (W&B)](https://wandb.ai/) | ML experiment tracking + LLM tracing | Integrates tracing with model evaluation runs |
| [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) | Vendor-neutral | Export to any backend (Jaeger, Zipkin, Datadog, Honeycomb) |

The patterns you practice in this tutorial — emitting spans, asserting on attributes, detecting error spans — transfer directly to all of these platforms.

---

## Running the Tutorial

```bash
# From the repo root
npm run test:18

# Or directly
npx playwright test --config=18-agent-observability/playwright.config.ts
```

### Prerequisites
- Node.js 18+
- `npm install` at the repo root (installs Playwright and Express)

### What happens
1. Playwright starts the Express server on port 3018.
2. The eight tests run against the server.
3. An HTML report is written to `18-agent-observability/playwright-report/`.

---

## File Structure

```
18-agent-observability/
├── demo/
│   └── server.js          # Express server with agent trace endpoints
├── tests/
│   └── observability.spec.ts  # Playwright tests asserting on trace data
├── prompts/
│   └── spec.md            # Plain-English specification
├── playwright.config.ts   # Playwright config (port 3018, webServer)
└── README.md              # This file
```
