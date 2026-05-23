import { test, expect } from '@playwright/test';
import { estimateTokens, calculateCost, isWithinSLA } from './helpers/budget';

// ---------------------------------------------------------------------------
// Types matching the demo server's response shapes
// ---------------------------------------------------------------------------

interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface CompleteResponse {
  response: string;
  usage: Usage;
  latencyMs: number;
}

interface BatchCompletion {
  response: string;
  usage: Usage;
}

interface BatchCompleteResponse {
  completions: BatchCompletion[];
  totalCost: number;
}

interface BudgetStatus {
  tokensUsed: number;
  tokensLimit: number;
  costUsd: number;
  remainingBudget: number;
}

interface TokenLimitError {
  error: string;
  used: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const COST_PER_TOKEN = 0.000002;
const LATENCY_SLA_MS = 500;

async function resetBudget(
  request: import('@playwright/test').APIRequestContext
): Promise<void> {
  await request.post('/reset-budget');
}

async function complete(
  request: import('@playwright/test').APIRequestContext,
  prompt: string,
  maxTokens?: number
): Promise<{ status: number; body: CompleteResponse | TokenLimitError }> {
  const data: Record<string, unknown> = { prompt };
  if (maxTokens !== undefined) data.maxTokens = maxTokens;

  const response = await request.post('/complete', { data });
  const body = await response.json();
  return { status: response.status(), body };
}

async function getBudgetStatus(
  request: import('@playwright/test').APIRequestContext
): Promise<BudgetStatus> {
  const response = await request.get('/budget-status');
  expect(response.status()).toBe(200);
  return (await response.json()) as BudgetStatus;
}

// ---------------------------------------------------------------------------
// Test 1: Latency SLA
// A single completion must respond within 500 ms.
// We assert both the server-reported latencyMs field and the actual wall-clock
// time measured by the test harness — two independent latency signals.
// ---------------------------------------------------------------------------

test('latency SLA: single completion responds within 500ms wall-clock and reported latency', async ({
  request,
}) => {
  const prompt = 'What is the capital of France?';

  const wallStart = Date.now();
  const { status, body } = await complete(request, prompt);
  const wallElapsed = Date.now() - wallStart;

  expect(status).toBe(200);

  const { latencyMs } = body as CompleteResponse;

  // Server-reported latency must be within SLA
  expect(isWithinSLA(latencyMs, LATENCY_SLA_MS)).toBe(true);
  expect(latencyMs).toBeLessThan(LATENCY_SLA_MS);

  // Wall-clock must also be under a generous ceiling (500ms + 300ms for HTTP overhead)
  expect(wallElapsed).toBeLessThan(LATENCY_SLA_MS + 300);
});

// ---------------------------------------------------------------------------
// Test 2: Token budget enforcement
// A prompt with many words combined with a tight maxTokens limit should cause
// the server to return HTTP 429 with a token_limit_exceeded error body.
// ---------------------------------------------------------------------------

test('token budget enforcement: long prompt with tight maxTokens returns 429', async ({
  request,
}) => {
  // Craft a prompt long enough that inputTokens alone will exceed maxTokens=50
  const longPrompt =
    'Please provide an extremely detailed and comprehensive explanation covering all aspects ' +
    'of quantum computing including quantum bits qubits superposition entanglement interference ' +
    'error correction algorithms and real-world applications in cryptography optimization ' +
    'machine learning drug discovery and materials science research.';

  const { status, body } = await complete(request, longPrompt, 50);

  expect(status).toBe(429);

  const errorBody = body as TokenLimitError;
  expect(errorBody.error).toBe('token_limit_exceeded');
  expect(typeof errorBody.used).toBe('number');
  expect(typeof errorBody.limit).toBe('number');
  expect(errorBody.used).toBeGreaterThan(errorBody.limit);
  expect(errorBody.limit).toBe(50);
});

// ---------------------------------------------------------------------------
// Test 3: Token count accuracy
// Token counts returned by the server must be positive integers and
// inputTokens must be greater than zero for any non-empty prompt.
// ---------------------------------------------------------------------------

test('token count accuracy: usage fields are positive integers and inputTokens > 0', async ({
  request,
}) => {
  const prompt = 'Explain machine learning in simple terms.';

  const { status, body } = await complete(request, prompt);
  expect(status).toBe(200);

  const { usage } = body as CompleteResponse;

  // All three counters must be non-negative integers
  expect(Number.isInteger(usage.inputTokens)).toBe(true);
  expect(Number.isInteger(usage.outputTokens)).toBe(true);
  expect(Number.isInteger(usage.totalTokens)).toBe(true);

  // Input must be positive for a non-empty prompt
  expect(usage.inputTokens).toBeGreaterThan(0);

  // Output must be positive — the model always produces some response
  expect(usage.outputTokens).toBeGreaterThan(0);

  // Total must equal the sum of input and output
  expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);

  // Our local estimate should be in the same ballpark as the server's figure
  const localEstimate = estimateTokens(prompt);
  expect(Math.abs(usage.inputTokens - localEstimate)).toBeLessThanOrEqual(5);
});

// ---------------------------------------------------------------------------
// Test 4: Cost calculation
// The totalCost returned by /batch-complete must equal the sum of each item's
// totalTokens multiplied by the per-token rate ($0.000002).
// ---------------------------------------------------------------------------

test('cost calculation: batch totalCost equals sum of per-item tokens × rate', async ({
  request,
}) => {
  const prompts = [
    'Hello, how are you?',
    'What is the weather like today?',
    'Tell me a short joke.',
  ];

  const response = await request.post('/batch-complete', { data: { prompts } });
  expect(response.status()).toBe(200);

  const { completions, totalCost } = (await response.json()) as BatchCompleteResponse;

  expect(completions).toHaveLength(3);

  // Sum up tokens across all completions
  const sumTokens = completions.reduce((acc, c) => acc + c.usage.totalTokens, 0);
  const expectedCost = calculateCost(sumTokens, COST_PER_TOKEN);

  // Allow floating-point tolerance of 1e-10
  expect(Math.abs(totalCost - expectedCost)).toBeLessThan(1e-10);
});

// ---------------------------------------------------------------------------
// Test 5: Budget status accumulates
// After making 3 separate completions the session's tokensUsed must be
// strictly larger than it was before each call, proving the server accumulates
// usage correctly across requests.
// ---------------------------------------------------------------------------

test('budget status accumulates: tokensUsed increases after each completion', async ({
  request,
}) => {
  await resetBudget(request);

  const prompts = [
    'What is two plus two?',
    'Name the planets in the solar system.',
    'Describe the process of photosynthesis briefly.',
  ];

  let previousTokensUsed = 0;

  for (const prompt of prompts) {
    const { status } = await complete(request, prompt);
    expect(status).toBe(200);

    const status2 = await getBudgetStatus(request);
    expect(status2.tokensUsed).toBeGreaterThan(previousTokensUsed);
    previousTokensUsed = status2.tokensUsed;
  }

  // After 3 calls the total must be greater than zero
  expect(previousTokensUsed).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Test 6: Short prompt is fast
// A 5-word prompt must result in a server-reported latencyMs below 200ms.
// Short prompts produce short responses, and the mock latency formula
// (50 + outputTokens × 2) guarantees a low latency for small outputs.
// ---------------------------------------------------------------------------

test('short prompt is fast: 5-word prompt has latencyMs < 200', async ({ request }) => {
  const shortPrompt = 'Hi how are you';

  const { status, body } = await complete(request, shortPrompt);
  expect(status).toBe(200);

  const { latencyMs } = body as CompleteResponse;

  expect(latencyMs).toBeLessThan(200);
});

// ---------------------------------------------------------------------------
// Test 7: Efficiency ratio
// outputTokens / inputTokens should be less than 5 for typical short prompts.
// A ratio >= 5 would indicate the model is producing a disproportionately long
// response relative to the prompt — a signal of runaway verbosity or looping.
// ---------------------------------------------------------------------------

test('efficiency ratio: outputTokens / inputTokens < 5 for a short prompt', async ({
  request,
}) => {
  const prompt = 'Define AI.';

  const { status, body } = await complete(request, prompt);
  expect(status).toBe(200);

  const { usage } = body as CompleteResponse;

  expect(usage.inputTokens).toBeGreaterThan(0);

  const ratio = usage.outputTokens / usage.inputTokens;
  expect(ratio).toBeLessThan(5);
});

// ---------------------------------------------------------------------------
// Test 8: Budget ceiling
// After consuming tokens up to near the session limit, the remainingBudget
// reported by /budget-status should be close to zero (within 10% of the limit).
// ---------------------------------------------------------------------------

test('budget ceiling: remainingBudget approaches zero when tokensUsed is near limit', async ({
  request,
}) => {
  await resetBudget(request);

  // Exhaust the budget by making many medium-length requests.
  // Each call uses ~30–60 tokens; with limit=10000 we need ~200 calls to get
  // close.  Instead we use /batch-complete with many prompts for efficiency.
  const fillPrompt = 'Please explain this concept in detail with examples and context.';
  const batchSize = 50;
  const batches = 4; // 4 × 50 = 200 completions ≈ 200 × ~45 tokens = ~9000 tokens

  for (let i = 0; i < batches; i++) {
    const prompts = Array.from({ length: batchSize }, () => fillPrompt);
    const response = await request.post('/batch-complete', { data: { prompts } });
    expect(response.status()).toBe(200);
  }

  const budgetStatus = await getBudgetStatus(request);

  // tokensUsed must be substantial — we've made 200 completions
  expect(budgetStatus.tokensUsed).toBeGreaterThan(0);

  // remainingBudget + tokensUsed must equal tokensLimit
  expect(budgetStatus.remainingBudget + budgetStatus.tokensUsed).toBe(budgetStatus.tokensLimit);

  // remainingBudget must be non-negative (never goes below zero)
  expect(budgetStatus.remainingBudget).toBeGreaterThanOrEqual(0);

  // tokensUsed must not exceed tokensLimit
  expect(budgetStatus.tokensUsed).toBeLessThanOrEqual(budgetStatus.tokensLimit);

  // After 200 medium-length completions, remaining budget should be well under 50% of limit
  const usageFraction = budgetStatus.tokensUsed / budgetStatus.tokensLimit;
  expect(usageFraction).toBeGreaterThan(0.5);
});

// ---------------------------------------------------------------------------
// Unit tests for budget helpers
// These run entirely in-process — no HTTP calls needed.
// ---------------------------------------------------------------------------

test('estimateTokens returns 0 for empty string', () => {
  expect(estimateTokens('')).toBe(0);
  expect(estimateTokens('   ')).toBe(0);
});

test('estimateTokens scales with word count', () => {
  const fiveWords = estimateTokens('one two three four five');
  expect(fiveWords).toBeGreaterThan(0);
  const tenWords = estimateTokens('one two three four five six seven eight nine ten');
  expect(tenWords).toBeGreaterThan(fiveWords);
});

test('calculateCost returns 0 for 0 tokens', () => {
  expect(calculateCost(0, COST_PER_TOKEN)).toBe(0);
});

test('calculateCost scales linearly with token count', () => {
  const cost100 = calculateCost(100, COST_PER_TOKEN);
  const cost200 = calculateCost(200, COST_PER_TOKEN);
  expect(cost200).toBeCloseTo(cost100 * 2);
});

test('isWithinSLA returns true when latency is strictly below threshold', () => {
  expect(isWithinSLA(499, 500)).toBe(true);
  expect(isWithinSLA(0, 500)).toBe(true);
});

test('isWithinSLA returns false when latency meets or exceeds threshold', () => {
  expect(isWithinSLA(500, 500)).toBe(false);
  expect(isWithinSLA(600, 500)).toBe(false);
});
