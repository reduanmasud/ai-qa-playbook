# Tutorial 21: Multi-Agent Pipeline Testing

Real AI systems are rarely a single model answering a single question. They are **pipelines** — chains of specialized agents where each one's output becomes the next one's input. A planner decomposes a goal. A researcher gathers evidence. A writer synthesizes a response. Testing this architecture requires a different mindset than testing a single endpoint.

---

## What you will learn

- The **four-layer testing model** for multi-agent systems
- Why pipeline testing is not the same as testing each agent independently
- How to write **interface contracts** between agents
- How to **isolate failures** in a multi-agent chain
- How **contract testing** (borrowed from microservices) applies to AI pipelines
- How these concepts map to real frameworks like CrewAI, AutoGen, and LangGraph

---

## The demo system

A 3-agent pipeline that generates a research report from a topic string:

```
topic (string)
    │
    ▼
┌─────────────┐
│   Planner   │  → { plan: string[], estimatedSteps: number }
└─────────────┘
        │
        ▼
┌─────────────────┐
│   Researcher    │  → { findings: string[], sources: number }
└─────────────────┘
        │
        ▼
┌──────────────┐
│    Writer    │  → { content: string, wordCount: number }
└──────────────┘
        │
        ▼
  finalOutput (string)
```

The server exposes three routes:
- `POST /pipeline/run` — run all agents end-to-end
- `POST /pipeline/run-stage` — run any single agent in isolation
- `GET /pipeline/:pipelineId` — retrieve a stored result

---

## The four-layer testing model

### Layer 1: Individual agents

Test each agent in isolation via `/pipeline/run-stage`. Treat each agent as its own unit:

```typescript
// Planner alone — does it produce a plan array?
const { output } = await runStage('planner', 'climate change');
expect(output.plan.length).toBeGreaterThan(0);
expect(output.estimatedSteps).toBe(output.plan.length);
```

**Why this matters:** When a pipeline fails, you need to know whether the failure is in agent A, agent B, or the boundary between them. If you only test the full pipeline, you cannot tell.

### Layer 2: Interface contracts

Test that agent A's output shape satisfies agent B's input expectations, before involving the full pipeline. This is the "contract" layer.

```typescript
// Get real planner output
const plannerOutput = await runStage('planner', 'machine learning');

// Assert it has the shape the researcher expects
expect(Array.isArray(plannerOutput.plan)).toBe(true);

// Pass it directly into researcher — no translation needed
const researcherOutput = await runStage('researcher', plannerOutput);
expect(researcherOutput.findings.length).toBeGreaterThan(0);
```

**Why this matters:** A planner might technically produce the right data, but if the field name changes from `plan` to `steps`, the researcher will silently receive `undefined` and may still return something. Contract tests catch this boundary regression before it reaches the full pipeline.

### Layer 3: Pipeline integration

Test the full end-to-end flow. Verify:
- All stages are present in order
- Each stage's output is valid
- `finalOutput` matches the last stage's content
- Results are persisted and retrievable by ID

```typescript
const result = await runFullPipeline('quantum computing');
expect(result.stages.map(s => s.agent)).toEqual(['planner', 'researcher', 'writer']);
expect(result.finalOutput).toBe(result.stages[2].output.content);
```

**Why this matters:** Even if all individual agents pass and all contracts are valid, integration can still fail — e.g., the orchestrator wires the wrong stage's output to the next stage's input, or the pipeline skips a stage under certain conditions.

### Layer 4: Adversarial / error propagation

Test how the pipeline behaves when something goes wrong. Does it fail clearly or fail silently?

```typescript
// Empty topic should produce a 400, not a partial result
const { status } = await runFullPipeline('');
expect(status).toBe(400);

// Researcher with an empty plan should produce a 422, not empty findings
const { status } = await runStage('researcher', { plan: [], estimatedSteps: 0 });
expect(status).toBe(422);
```

**Why this matters:** A pipeline that silently degrades is dangerous. If the planner returns an empty plan and the researcher quietly returns zero findings, the writer may produce plausible-looking but entirely fabricated output. Silent failures in AI pipelines can reach users undetected.

---

## Why pipeline testing is different from testing the sum of parts

Imagine each agent passes its own unit tests perfectly. The pipeline can still fail because:

1. **The orchestration wiring is wrong** — agent B receives agent A's input, not its output
2. **Schema drift** — agent A adds a new field that agent B does not handle, or renames a field
3. **State pollution** — a previous pipeline run's state leaks into the current run
4. **Order matters** — running writer before researcher produces nonsense, even if both pass unit tests
5. **Error masking** — an upstream agent error is swallowed and the downstream agent compensates in a misleading way

Unit tests tell you the parts work. Integration tests tell you the assembly works. Contract tests tell you the boundaries are stable. You need all three layers.

---

## Interface contracts between agents

Each agent in this pipeline has an explicit input/output contract:

| Agent      | Input type                                   | Output type                              |
|------------|----------------------------------------------|------------------------------------------|
| Planner    | `string`                                     | `{ plan: string[], estimatedSteps: number }` |
| Researcher | `{ plan: string[], estimatedSteps: number }` | `{ findings: string[], sources: number }` |
| Writer     | `{ findings: string[], sources: number }`    | `{ content: string, wordCount: number }` |

These contracts must be tested independently of the pipeline orchestrator. The `/pipeline/run-stage` endpoint makes this possible by letting you inject any input into any stage.

In production systems, these contracts are often enforced with JSON Schema, Zod, Pydantic models, or TypeScript interfaces at the agent boundaries.

---

## Isolating failures in a multi-agent system

When a full pipeline test fails:

1. **Run each stage individually** with the same input to find which agent produces unexpected output
2. **Check interface boundaries** — run the upstream agent, capture its output, manually pass it to the downstream agent
3. **Inspect intermediate outputs** — the `stages` array in `/pipeline/run` exposes every agent's input and output, not just the final result
4. **Check ordering** — assert `stages[i].agent === expectedOrder[i]` to rule out wiring bugs

The `/pipeline/run` endpoint stores intermediate stage data precisely to enable this kind of post-mortem analysis.

---

## The contract testing approach (borrowed from microservices)

In microservices, **consumer-driven contract testing** (popularized by Pact) works like this:
- The consumer (service B) defines what shape it expects from the provider (service A)
- The provider runs those expectations as tests against its own output
- If the provider breaks the contract, CI fails before deployment

The same principle applies to AI agent pipelines:
- The researcher is the "consumer" of the planner's output
- The writer is the "consumer" of the researcher's output
- Each consumer defines what shape it needs
- Tests verify that the upstream producer satisfies those expectations

The key insight is: **test the contract at the boundary, not only inside each agent**. This is what Layer 2 tests do.

---

## Connection to real frameworks

### CrewAI
Agents are defined with roles and tasks. Each task has an `expected_output` description. Contract testing means asserting that the actual output of a task matches the shape described in `expected_output` before the next task receives it.

### AutoGen
Agents communicate via message passing. The "interface" is the message schema between agents. Contract tests would assert that the message emitted by agent A conforms to the type expected by agent B's `on_message` handler.

### LangGraph
Nodes are connected by edges. The `State` object flows through the graph. Contract testing in LangGraph means asserting that after each node executes, the fields it is responsible for in the `State` object have the correct shape and are not `None` / `undefined` when the downstream node requires them.

In all three frameworks, the same principle applies: **the boundary between agents is the most fragile part of the system and must be tested explicitly**.

---

## Running the tests

```bash
# From the repo root
npm run test:21

# Or directly
npx playwright test --config=21-multi-agent-pipeline/playwright.config.ts
```

The server starts automatically on port 3021. Tests cover all four layers.
