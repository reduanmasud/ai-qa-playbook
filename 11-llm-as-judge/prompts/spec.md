# Test Spec — LLM-as-Judge Evaluation

## Target
Base URL: http://localhost:3011
Server: node 11-llm-as-judge/demo/server.js (started automatically by Playwright)

## Endpoints

### POST /summarize
- Body: `{ text: string }`
- Response: `{ summary: string }`
- Returns first 100 characters of text + "..." as a mock AI summarizer
- Returns 400 if `text` is missing or empty

### POST /evaluate  (the LLM judge)
- Body: `{ output: string, criteria: string }`
- Response: `{ score: number, reasoning: string }`
- `score` is always an integer between 1 and 5 inclusive
- `reasoning` is a non-empty string explaining the score
- Scoring heuristics (mock judge rules):
  - Base score: 1
  - output.length > 50 → +1 (substance)
  - output.length > 20 → +1 (minimal content)
  - Ends with `.`, `!`, or `?` → +1 (well-formed)
  - No word repeated more than 3 times → +1 (not gibberish)
  - Score capped at 5, floored at 1
- Returns 400 if `output` or `criteria` are missing

## Tests Required

1. Submit a 500-word article to /summarize, then pass the summary to /evaluate with
   criteria "Is the summary concise (under 100 words)? Does it capture key points?
   Is it well-written?" — assert score >= 3.

2. Verify the judge always returns both a numeric score (1-5) and a non-empty
   reasoning string regardless of what output is submitted.

3. Submit an empty string as output to /evaluate — assert score <= 2.

4. Submit highly repetitive gibberish text to /evaluate — assert score <= 2.

5. Meta-evaluation: call /evaluate on a sample text, then feed the resulting
   `reasoning` string back into /evaluate as the new `output` — assert the
   judge's own reasoning scores >= 3 (coherent output).

6. Verify /summarize returns 400 when the request body has no `text` field.

7. Verify /evaluate returns 400 when the request body has no `criteria` field.

8. Boundary check: submit several varied inputs and verify score is always
   within the 1–5 range.

## Key Assertions (the LLM-as-Judge philosophy)

- Do NOT assert exact score values — use thresholds (>= 3, <= 2)
- DO assert that `reasoning` is always present and non-empty
- DO assert the score is within bounds (1-5)
- DO distinguish good outputs (score >= 3) from bad outputs (score <= 2)

## Notes for Claude
Use Playwright's `request` fixture — no browser needed.
Use `request.post()` for all requests.
Use `await response.json()` to read the body.
Type response bodies using TypeScript interfaces (SummarizeResponse, EvaluateResponse).
Use `toBeGreaterThanOrEqual` / `toBeLessThanOrEqual` for threshold assertions — never `toBe(4)`.
