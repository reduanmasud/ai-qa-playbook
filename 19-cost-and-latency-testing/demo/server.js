const express = require('express');
const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Session-level budget tracker
// ---------------------------------------------------------------------------
// In a real system this would be persisted per user/session in a database.
// Here we keep a simple in-memory counter that accumulates across requests.
// ---------------------------------------------------------------------------

let sessionTokensUsed = 0;
const SESSION_TOKEN_LIMIT = 10000;
const COST_PER_TOKEN = 0.000002; // $0.000002 per token (mock rate)

/**
 * Generate a mock AI response for a given prompt.
 * Response length is proportional to the prompt length — simulating a realistic
 * input→output ratio without calling a real LLM.
 *
 * @param {string} prompt
 * @returns {string}
 */
function generateResponse(prompt) {
  const words = prompt.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Short prompts → brief answers; longer prompts → slightly longer answers
  if (wordCount <= 5) {
    return 'This is a concise response to your short prompt.';
  }
  if (wordCount <= 20) {
    return 'Thank you for your question. Based on what you have described, I can provide a helpful and relevant answer that addresses the key points you raised.';
  }
  return (
    'I have carefully reviewed your detailed prompt. ' +
    'Here is a thorough response that covers the main aspects of your request. ' +
    'The information provided should give you a clear understanding of the topic. ' +
    'Please let me know if you need any clarification or additional details on any of the points mentioned above.'
  );
}

/**
 * Estimate token count for a text string.
 * Mock formula: word count × 1.3, truncated to integer.
 * Mirrors the subword tokenisation that real LLMs use (roughly 1.3 tokens/word).
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokenCount(text) {
  const words = text.split(/\s+/).filter(Boolean);
  return (words.length * 1.3) | 0;
}

// ---------------------------------------------------------------------------
// POST /complete
// Body:    { prompt: string, maxTokens?: number }
// Returns: { response: string, usage: { inputTokens, outputTokens, totalTokens }, latencyMs }
// Returns 429 if totalTokens > maxTokens (default 1000)
// ---------------------------------------------------------------------------

app.post('/complete', (req, res) => {
  const { prompt, maxTokens } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt field is required and must be a non-empty string' });
  }

  const limit = typeof maxTokens === 'number' ? maxTokens : 1000;

  // Calculate token usage
  const response = generateResponse(prompt);
  const inputTokens = estimateTokenCount(prompt);
  const outputTokens = response.split(/\s+/).filter(Boolean).length;
  const totalTokens = inputTokens + outputTokens;

  // Enforce token limit — return 429 if exceeded
  if (totalTokens > limit) {
    return res.status(429).json({
      error: 'token_limit_exceeded',
      used: totalTokens,
      limit,
    });
  }

  // Simulate processing latency: base 50ms + 2ms per output token
  const latencyMs = 50 + outputTokens * 2;

  // Accumulate session usage
  sessionTokensUsed += totalTokens;

  return res.json({ response, usage: { inputTokens, outputTokens, totalTokens }, latencyMs });
});

// ---------------------------------------------------------------------------
// POST /batch-complete
// Body:    { prompts: string[] }
// Returns: { completions: Array<{ response, usage }>, totalCost: number }
// ---------------------------------------------------------------------------

app.post('/batch-complete', (req, res) => {
  const { prompts } = req.body;

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return res.status(400).json({ error: 'prompts must be a non-empty array of strings' });
  }

  let grandTotalTokens = 0;

  const completions = prompts.map((prompt) => {
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return {
        response: '',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }

    const response = generateResponse(prompt);
    const inputTokens = estimateTokenCount(prompt);
    const outputTokens = response.split(/\s+/).filter(Boolean).length;
    const totalTokens = inputTokens + outputTokens;

    grandTotalTokens += totalTokens;
    sessionTokensUsed += totalTokens;

    return { response, usage: { inputTokens, outputTokens, totalTokens } };
  });

  const totalCost = grandTotalTokens * COST_PER_TOKEN;

  return res.json({ completions, totalCost });
});

// ---------------------------------------------------------------------------
// GET /budget-status
// Returns accumulated session-level usage and remaining budget.
// ---------------------------------------------------------------------------

app.get('/budget-status', (_req, res) => {
  const costUsd = sessionTokensUsed * COST_PER_TOKEN;
  const remainingBudget = Math.max(0, SESSION_TOKEN_LIMIT - sessionTokensUsed);

  return res.json({
    tokensUsed: sessionTokensUsed,
    tokensLimit: SESSION_TOKEN_LIMIT,
    costUsd,
    remainingBudget,
  });
});

// ---------------------------------------------------------------------------
// POST /reset-budget  (test utility — lets each test start from a clean slate)
// ---------------------------------------------------------------------------

app.post('/reset-budget', (_req, res) => {
  sessionTokensUsed = 0;
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 3019;
app.listen(PORT, () =>
  console.log(`Cost & Latency demo server running at http://localhost:${PORT}`)
);
