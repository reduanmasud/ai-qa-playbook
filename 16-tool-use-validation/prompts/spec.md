# Tutorial 16 – Tool Use Validation / Trajectory Testing

## What We Are Testing

Modern AI agents solve tasks by calling tools — functions like `search`, `calculate`, or `get_weather`.
Instead of only checking the final answer, trajectory testing validates the entire reasoning path:

- Did the agent pick the right tool?
- Were the tool parameters correct?
- Did the agent use the tool output when forming its final answer?
- Did the agent avoid unnecessary extra tool calls?

## The Agent Under Test

The demo server at `http://localhost:3016` exposes a mock agent that has access to three tools:

| Tool        | Purpose                              | Trigger heuristic                        |
|-------------|--------------------------------------|------------------------------------------|
| `search`    | Look up general information          | Any task that does not match below       |
| `calculate` | Evaluate a math expression           | Task contains a digit AND a math operator|
| `get_weather` | Get current weather for a city     | Task contains the word "weather"         |

### POST /agent/run

Request:
```json
{ "task": "What is the weather in London?" }
```

Response:
```json
{
  "trajectory": [
    {
      "step": 1,
      "tool": "get_weather",
      "input": { "city": "London" },
      "output": { "city": "London", "temperature": 15, "unit": "C", "condition": "Cloudy", "humidity": 72 }
    }
  ],
  "finalAnswer": "The current weather in London is Cloudy with a temperature of 15°C and humidity at 72%."
}
```

### GET /tools

Returns the list of available tools with `name` and `description` for each.

## Test Scenarios

1. **Correct tool selection** — verify the agent routes to the right tool for each task type.
2. **Tool parameter correctness** — verify the tool receives the intended input (e.g. `city`, `expression`).
3. **Trajectory completeness** — every step must have `step`, `tool`, `input`, and `output` fields.
4. **Tool call count** — a simple one-step task must not produce more than one tool call.
5. **Final answer uses tool output** — the `finalAnswer` must reference data returned by the tool.
6. **Available tools endpoint** — `GET /tools` returns a well-formed list of tool descriptors.
7. **Tool Call Accuracy (TCA) metric** — run tasks covering all three tool types and compute the percentage of correct tool selections.
8. **Edge cases** — empty or missing `task` should return HTTP 400.

## Key Metrics

**Tool Call Accuracy (TCA)**
```
TCA = (number of correct tool selections / total tasks) * 100
```
A deterministic mock agent should achieve 100 %. A real LLM-backed agent would aim for >90 %.

**Trajectory Efficiency**
```
Efficiency = (minimum steps needed / actual steps taken)
```
Simple single-step tasks should have efficiency = 1.0 (no wasted tool calls).

## Helper Utilities

`tests/helpers/trajectory.ts` exports:

- `findToolCall(trajectory, toolName)` — returns the first step that used `toolName`, or `undefined`.
- `computeToolCallAccuracy(results)` — accepts an array of `{ expectedTool, actualTool }` and returns a 0–100 accuracy score.
