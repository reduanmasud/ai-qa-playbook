# Tutorial 16 — Tool Use Validation / Trajectory Testing

## What Is Trajectory Testing?

Modern AI agents do not just output text — they call external **tools**: search APIs, calculators, code interpreters, databases, and more. An agent is only as reliable as its ability to:

1. **Select the right tool** for a given task
2. **Pass correct parameters** to that tool
3. **Interpret the result** and incorporate it into a coherent final answer
4. **Avoid redundant calls** that waste time and money

**Trajectory testing** (also called trace testing or agent evaluation) checks every step of this process, not just the final output. The _trajectory_ is the ordered list of tool calls the agent made, each recording:

```json
{
  "step": 1,
  "tool": "get_weather",
  "input": { "city": "London" },
  "output": { "temperature": 15, "condition": "Cloudy" }
}
```

Testing the trajectory lets you catch mistakes that would be invisible if you only checked the final answer — for example, an agent that gives the right weather data but looked it up for the wrong city.

---

## Final Answers vs. Reasoning Paths

| What you test          | What you catch                                               |
|------------------------|--------------------------------------------------------------|
| **Final answer only**  | Wrong answer text; hallucinated facts                        |
| **Trajectory (path)**  | Wrong tool selected; wrong parameters; unnecessary extra calls; answer does not reflect tool output |

A real-world example: an agent answering "What is 15 × 7?" might produce "105" in its final answer by hallucinating rather than actually calling `calculate`. Final-answer testing passes; trajectory testing fails because the `calculate` tool was never used.

---

## Key Metrics

### Tool Call Accuracy (TCA)

The percentage of tasks where the agent selected the correct tool:

```
TCA = (correctly routed tasks / total tasks) × 100
```

- **100%** — perfect routing (expected from deterministic mock agents)
- **≥ 90%** — acceptable threshold for LLM-backed agents in production
- **< 80%** — indicates unreliable routing; investigate system prompt or tool descriptions

### Trajectory Efficiency

Measures whether the agent took unnecessary extra steps:

```
Efficiency = minimum steps required / actual steps taken
```

- **1.0** — optimal; no wasted calls
- **< 1.0** — agent made redundant tool calls (e.g. two searches for a single question)

---

## Testing Multi-Step Tool Use Chains

Some tasks require chaining multiple tools. For example:

1. `search("capital of France")` → returns "Paris"
2. `get_weather("Paris")` → returns weather data

Trajectory tests for multi-step chains verify:

- Steps occur in the expected order
- The output of step N feeds the input of step N+1
- The final answer synthesises information from all steps

The `findToolCall` helper makes it easy to assert on any step by tool name, regardless of position.

---

## Connection to Agent Frameworks

This tutorial's patterns apply directly to production agent frameworks:

| Framework        | How trajectories are surfaced                                              |
|------------------|----------------------------------------------------------------------------|
| **LangChain**    | `agent.run()` with `verbose=True`; `AgentExecutor` emits `on_tool_start` / `on_tool_end` callbacks |
| **AutoGPT**      | Each "thought–action–observation" cycle maps to one trajectory step        |
| **Claude Tool Use** | `tool_use` and `tool_result` content blocks in the messages array give a full trace |
| **OpenAI Assistants** | `run.steps` list exposes each `tool_call` and its result               |

The `POST /agent/run` endpoint in this tutorial deliberately mimics the shape of these real responses so the test patterns transfer directly.

---

## Project Structure

```
16-tool-use-validation/
├── demo/
│   └── server.js              # Express mock agent on port 3016
├── tests/
│   ├── helpers/
│   │   └── trajectory.ts      # findToolCall + computeToolCallAccuracy
│   └── tool-use.spec.ts       # 13 Playwright tests
├── prompts/
│   └── spec.md                # Plain-English specification
├── playwright.config.ts
└── README.md
```

---

## Running the Tests

```bash
# From the repository root
npx playwright test --config=16-tool-use-validation/playwright.config.ts

# Or from inside this folder
cd 16-tool-use-validation
npx playwright test
```

The `webServer` block in `playwright.config.ts` starts `demo/server.js` automatically before the tests run and shuts it down afterwards.

---

## What Each Test Covers

| # | Test name | Concept tested |
|---|-----------|----------------|
| 1 | Correct tool selection: weather | Tool routing |
| 2 | Tool parameter correctness: calculate | Input accuracy |
| 3 | Trajectory completeness | Schema validation |
| 4 | Tool call count | Trajectory efficiency |
| 5a | Final answer uses tool output: weather | Output grounding |
| 5b | Final answer uses tool output: calculate | Output grounding |
| 6a | Available tools endpoint: structure | API contract |
| 6b | Available tools endpoint: known names | API contract |
| 7 | TCA metric across 3 task types | Aggregate accuracy |
| 8a | Edge case: empty task → 400 | Error handling |
| 8b | Edge case: missing task → 400 | Error handling |
| 9 | Search routes correctly | Tool routing |
| 10a–c | computeToolCallAccuracy helper | Utility correctness |
