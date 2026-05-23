import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types matching the demo server's response shapes
// ---------------------------------------------------------------------------

interface SummarizeResponse {
  summary: string;
}

interface EvaluateResponse {
  score: number;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Sample article used across multiple tests
// ---------------------------------------------------------------------------

const SAMPLE_ARTICLE = `
Artificial intelligence is rapidly transforming how software is developed and tested.
Modern test engineers must understand not only traditional assertion-based testing but
also evaluation frameworks designed for non-deterministic AI outputs. Large language
models can produce different responses to identical prompts, making exact-match
assertions unreliable. Instead, quality must be measured using rubrics: does the output
capture the main point? Is it concise? Does it avoid hallucination? The LLM-as-Judge
pattern addresses this by routing the output to a second model that scores it against
the criteria, returning a numeric grade and human-readable reasoning. This allows
automated test suites to validate AI features at scale without requiring a human
reviewer for every run. Frameworks such as DeepEval, Giskard, and RAGAS formalise
these evaluation flows, providing metrics like answer relevancy, faithfulness, and
contextual precision. Understanding these concepts is essential for any engineer
building or maintaining AI-powered products in production.
`.trim();

const JUDGE_CRITERIA =
  'Is the summary concise (under 100 words)? Does it capture key points? Is it well-written?';

// ---------------------------------------------------------------------------
// Test 1: Happy path — good article produces an acceptable summary and score
// ---------------------------------------------------------------------------

test('summarize a real article and judge scores it 3 or higher', async ({ request }) => {
  // Step 1: Get a summary from the AI system under test
  const summarizeResponse = await request.post('/summarize', {
    data: { text: SAMPLE_ARTICLE },
  });

  expect(summarizeResponse.status()).toBe(200);

  const { summary } = (await summarizeResponse.json()) as SummarizeResponse;
  expect(typeof summary).toBe('string');
  expect(summary.length).toBeGreaterThan(0);

  // Step 2: Send the summary to the LLM judge for evaluation
  const evaluateResponse = await request.post('/evaluate', {
    data: {
      output: summary,
      criteria: JUDGE_CRITERIA,
    },
  });

  expect(evaluateResponse.status()).toBe(200);

  const { score, reasoning } = (await evaluateResponse.json()) as EvaluateResponse;

  // Step 3: Quality threshold assertion — NOT exact match
  // We accept any score of 3 or better; we don't care about the exact value.
  expect(score).toBeGreaterThanOrEqual(3);

  // Reasoning must always be present and non-trivial
  expect(typeof reasoning).toBe('string');
  expect(reasoning.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Test 2: Judge always returns both fields — structure contract
// ---------------------------------------------------------------------------

test('judge always returns a numeric score and a reasoning string', async ({ request }) => {
  const response = await request.post('/evaluate', {
    data: {
      output: 'AI helps engineers write better tests by automating checks.',
      criteria: 'Is this statement accurate and clear?',
    },
  });

  expect(response.status()).toBe(200);

  const body = (await response.json()) as EvaluateResponse;

  // score must be a number in range 1-5
  expect(typeof body.score).toBe('number');
  expect(body.score).toBeGreaterThanOrEqual(1);
  expect(body.score).toBeLessThanOrEqual(5);

  // reasoning must be a non-empty string
  expect(typeof body.reasoning).toBe('string');
  expect(body.reasoning.trim().length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Test 3: Deliberately bad output — empty string scores low (1-2)
// ---------------------------------------------------------------------------

test('empty output receives a low judge score (1 or 2)', async ({ request }) => {
  const response = await request.post('/evaluate', {
    data: {
      output: '',
      criteria: JUDGE_CRITERIA,
    },
  });

  expect(response.status()).toBe(200);

  const { score, reasoning } = (await response.json()) as EvaluateResponse;

  // Bad output should get a low score — quality threshold from the other direction
  expect(score).toBeLessThanOrEqual(2);

  // Even for bad output the judge explains itself
  expect(reasoning.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Test 4: Deliberately bad output — gibberish / repetition scores low
// ---------------------------------------------------------------------------

test('repetitive garbage output receives a low judge score', async ({ request }) => {
  const gibberish = 'the the the the the the the the the the the the the the.';

  const response = await request.post('/evaluate', {
    data: {
      output: gibberish,
      criteria: 'Is this a high-quality, informative summary?',
    },
  });

  expect(response.status()).toBe(200);

  const { score } = (await response.json()) as EvaluateResponse;

  // Repetitive low-quality output should score no higher than 2
  expect(score).toBeLessThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// Test 5: Meta-evaluation — judging the judge's own output
// ---------------------------------------------------------------------------
// This illustrates recursive evaluation: you can judge any text, including
// the reasoning produced by a previous judge call. In real systems this is
// used to detect judge hallucination or incoherent explanations.

test('meta-evaluation: judge reasoning is itself well-formed', async ({ request }) => {
  // First evaluation: produce a score + reasoning
  const firstEval = await request.post('/evaluate', {
    data: {
      output: SAMPLE_ARTICLE.slice(0, 150) + '.',
      criteria: JUDGE_CRITERIA,
    },
  });

  const { reasoning: firstReasoning } = (await firstEval.json()) as EvaluateResponse;

  // Second evaluation: judge the judge's own reasoning text
  const metaEval = await request.post('/evaluate', {
    data: {
      output: firstReasoning,
      criteria:
        'Is this evaluation reasoning clear and coherent? Does it explain the score? Is it grammatically correct?',
    },
  });

  expect(metaEval.status()).toBe(200);

  const { score: metaScore, reasoning: metaReasoning } =
    (await metaEval.json()) as EvaluateResponse;

  // The judge's own reasoning should be coherent enough to score at least 3
  expect(metaScore).toBeGreaterThanOrEqual(3);
  expect(metaReasoning.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Test 6: Input validation — /summarize rejects missing text field
// ---------------------------------------------------------------------------

test('/summarize returns 400 when text field is missing', async ({ request }) => {
  const response = await request.post('/summarize', {
    data: {},
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBeDefined();
});

// ---------------------------------------------------------------------------
// Test 7: Input validation — /evaluate rejects missing criteria
// ---------------------------------------------------------------------------

test('/evaluate returns 400 when criteria field is missing', async ({ request }) => {
  const response = await request.post('/evaluate', {
    data: { output: 'Some text without criteria.' },
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBeDefined();
});

// ---------------------------------------------------------------------------
// Test 8: Score is always an integer in the valid range regardless of input
// ---------------------------------------------------------------------------

test('judge score is always between 1 and 5 inclusive for any valid input', async ({ request }) => {
  const inputs = [
    { output: 'x', criteria: 'Is this good?' },
    { output: 'A'.repeat(200) + '.', criteria: 'Is this well-written?' },
    { output: 'Short.', criteria: 'Concise?' },
    { output: 'No punctuation here at all just words words words', criteria: 'Quality?' },
  ];

  for (const data of inputs) {
    const response = await request.post('/evaluate', { data });
    expect(response.status()).toBe(200);

    const { score } = (await response.json()) as EvaluateResponse;
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(5);
  }
});
