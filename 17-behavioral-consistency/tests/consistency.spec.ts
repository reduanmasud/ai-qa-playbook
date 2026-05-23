import { test, expect } from '@playwright/test';
import {
  computeConsistencyRate,
  detectContradiction,
  semanticContains,
  passAtK,
} from './helpers/consistency';

// ---------------------------------------------------------------------------
// Types matching the demo server's response shapes
// ---------------------------------------------------------------------------

interface AnswerResponse {
  answer: string;
  label: string;
}

interface BatchResult {
  question: string;
  answer: string;
  label: string;
}

interface BatchAnswerResponse {
  results: BatchResult[];
}

// ---------------------------------------------------------------------------
// Shared helper: POST /answer and return typed JSON
// ---------------------------------------------------------------------------

async function ask(
  request: Parameters<typeof test>[1] extends (...args: infer A) => unknown
    ? never
    : import('@playwright/test').APIRequestContext,
  question: string,
  seed?: number
): Promise<AnswerResponse> {
  const body: Record<string, unknown> = { question };
  if (seed !== undefined) body.seed = seed;

  const response = await request.post('/answer', { data: body });
  expect(response.status()).toBe(200);
  return (await response.json()) as AnswerResponse;
}

// ---------------------------------------------------------------------------
// Test 1: Label consistency across rephrasings
// Ask "capital of France" five different ways — every response must have
// label "geography".  Labels are a stable contract; wording is not.
// ---------------------------------------------------------------------------

test('label stays "geography" across 5 rephrasings of the capital question', async ({
  request,
}) => {
  const rephrasings = [
    'What is the capital of France?',
    "What is France's capital city?",
    'Paris is capital of which country?',
    'What capital city does France have?',
    'Tell me the capital city of France.',
  ];

  const labels: string[] = [];

  for (const question of rephrasings) {
    const { label } = await ask(request, question);
    labels.push(label);
  }

  // Every single rephrasing must return the same label
  const allGeography = labels.every((l) => l === 'geography');
  expect(allGeography).toBe(true);

  // Consistency rate must be 100% for labels (labels are deterministic)
  const rate = computeConsistencyRate(labels);
  expect(rate).toBe(1.0);
});

// ---------------------------------------------------------------------------
// Test 2: Answer stability with fixed seed
// The same question + seed must return exactly the same answer string every
// time.  This tests that the system is deterministic given a fixed seed,
// which is a prerequisite for reproducible regression tests.
// ---------------------------------------------------------------------------

test('same question and seed returns identical answer across 3 calls', async ({ request }) => {
  const question = 'What is the capital of France?';
  const seed = 0;

  const answers: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { answer } = await ask(request, question, seed);
    answers.push(answer);
  }

  // All three answers must be the exact same string
  const first = answers[0];
  for (const a of answers) {
    expect(a).toBe(first);
  }

  // Consistency rate must be 100%
  expect(computeConsistencyRate(answers)).toBe(1.0);
});

// ---------------------------------------------------------------------------
// Test 3: Semantic equivalence — math answers contain "4"
// We do NOT assert exact string equality.  Instead we assert that every
// answer mentions the number "4", regardless of how the question was phrased
// or how the answer is worded.  This is the semantic-equivalence approach.
// ---------------------------------------------------------------------------

test('all rephrasings of "2+2" return answers that semantically contain "4"', async ({
  request,
}) => {
  const mathQuestions = [
    'What is 2 + 2?',
    '2 plus 2 equals?',
    'Add two and two',
  ];

  for (const question of mathQuestions) {
    const { answer } = await ask(request, question);
    // Property: answer must mention "4" somewhere
    expect(semanticContains(answer, '4')).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Test 4: Category consistency for programming questions
// Different Python questions, all phrased differently, must always return
// label "programming".  This validates that the topic classifier is robust
// to surface-level variation.
// ---------------------------------------------------------------------------

test('programming questions always return label "programming"', async ({ request }) => {
  const programmingQuestions = [
    'How do you define a function in Python?',
    'What is Python syntax for a for loop?',
    'Show me how to print in Python',
    'Explain list comprehension in Python',
    'How do you declare a variable in Python?',
  ];

  const labels: string[] = [];

  for (const question of programmingQuestions) {
    const { label } = await ask(request, question);
    labels.push(label);
  }

  const allProgramming = labels.every((l) => l === 'programming');
  expect(allProgramming).toBe(true);
});

// ---------------------------------------------------------------------------
// Test 5: pass@k metric — 80% consistency threshold
// Run the same question 5 times (k=5) without a seed to allow natural
// variation.  At least 4 out of 5 responses (≥80%) must return the same
// label.  This is the pass@k reliability metric used in AI evaluation.
// ---------------------------------------------------------------------------

test('pass@k: label is consistent on at least 80% of k=5 independent runs', async ({
  request,
}) => {
  const question = 'What is the capital of France?';
  const k = 5;
  const labels: string[] = [];

  for (let i = 0; i < k; i++) {
    // No seed — allow the server to pick a random one each time
    const { label } = await ask(request, question);
    labels.push(label);
  }

  const result = passAtK(labels, 0.8);

  // At least 80% of runs must agree on the same label
  expect(result.passed).toBe(true);
  expect(result.rate).toBeGreaterThanOrEqual(0.8);
  expect(result.modal).toBe('geography');
});

// ---------------------------------------------------------------------------
// Test 6: Contradiction detection
// Ask a true claim ("Is Paris the capital of France?") and a false claim
// ("Is Berlin the capital of France?").  Both cannot be answered with "yes"
// — that would be a logical contradiction.  We verify the server does not
// affirm two mutually exclusive claims.
// ---------------------------------------------------------------------------

test('answers to opposite-framed questions are not both affirmative', async ({ request }) => {
  // Seed 0 → first variant, which starts with "The capital of France is Paris."
  const { answer: answerA } = await ask(request, 'Is Paris the capital of France?', 0);
  const { answer: answerB } = await ask(request, 'Is Berlin the capital of France?', 0);

  // The server should not affirm both.  The contradiction helper returns true
  // when both answers contain strong affirmative signals.
  const contradicts = detectContradiction(answerA, answerB);
  expect(contradicts).toBe(false);

  // Additionally, answerB should semantically contain "Paris", not "Berlin",
  // since the server classifies both as geography and returns the Paris answer.
  // (A real AI might refuse or say "No, the capital is Paris.")
  // Either way the server must not say Berlin is the capital.
  expect(answerB.toLowerCase()).not.toContain('berlin is the capital');
});

// ---------------------------------------------------------------------------
// Test 7: Batch consistency
// Submit 3 rephrasings of the same geography question to /batch-answer.
// All three results must carry label "geography" — the same guarantee as
// the individual label-consistency test but verified in a single round trip.
// ---------------------------------------------------------------------------

test('batch-answer returns consistent labels for rephrasings of the same question', async ({
  request,
}) => {
  const questions = [
    'What is the capital of France?',
    "What is France's capital?",
    'Name the capital city of France.',
  ];

  const response = await request.post('/batch-answer', {
    data: { questions },
  });

  expect(response.status()).toBe(200);

  const { results } = (await response.json()) as BatchAnswerResponse;

  expect(results).toHaveLength(3);

  const labels = results.map((r) => r.label);
  const allGeography = labels.every((l) => l === 'geography');

  // All three batch results must share the same label
  expect(allGeography).toBe(true);

  // Consistency rate across batch results must be 100%
  expect(computeConsistencyRate(labels)).toBe(1.0);

  // Each result must also contain an answer string
  for (const result of results) {
    expect(typeof result.answer).toBe('string');
    expect(result.answer.length).toBeGreaterThan(0);
  }
});

// ---------------------------------------------------------------------------
// Test 8: Input validation — /answer rejects missing question
// ---------------------------------------------------------------------------

test('/answer returns 400 when question field is missing', async ({ request }) => {
  const response = await request.post('/answer', { data: {} });
  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body.error).toBeDefined();
});

// ---------------------------------------------------------------------------
// Test 9: Input validation — /batch-answer rejects empty array
// ---------------------------------------------------------------------------

test('/batch-answer returns 400 when questions array is empty', async ({ request }) => {
  const response = await request.post('/batch-answer', { data: { questions: [] } });
  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body.error).toBeDefined();
});

// ---------------------------------------------------------------------------
// Test 10: computeConsistencyRate helper unit tests
// These run entirely in-process — no HTTP needed.  Playwright supports
// non-browser assertion tests via the `test` primitive.
// ---------------------------------------------------------------------------

test('computeConsistencyRate returns correct rates', () => {
  // All same → 1.0
  expect(computeConsistencyRate(['a', 'a', 'a'])).toBe(1.0);

  // All different → 1/3 ≈ 0.333
  expect(computeConsistencyRate(['a', 'b', 'c'])).toBeCloseTo(1 / 3);

  // 4 out of 5 same → 0.8
  expect(computeConsistencyRate(['x', 'x', 'x', 'x', 'y'])).toBe(0.8);

  // Single element → 1.0
  expect(computeConsistencyRate(['solo'])).toBe(1.0);

  // Empty → 0
  expect(computeConsistencyRate([])).toBe(0);
});

// ---------------------------------------------------------------------------
// Test 11: detectContradiction helper unit tests
// ---------------------------------------------------------------------------

test('detectContradiction identifies conflicting affirmative answers', () => {
  // Both clearly affirmative on opposite claims → contradiction
  expect(detectContradiction('Yes, that is correct.', 'Yes, indeed.')).toBe(true);

  // One negative → no contradiction
  expect(detectContradiction('Yes, Paris is the capital.', 'No, Berlin is not the capital.')).toBe(false);

  // Neither affirmative → no contradiction
  expect(detectContradiction('The capital is Paris.', 'Berlin is a German city.')).toBe(false);
});
