const express = require('express');
const app = express();
app.use(express.json());

/**
 * POST /summarize
 * Body: { text: string }
 * Response: { summary: string }
 *
 * Mock summarizer: returns first 100 characters of text + "..."
 * In a real system this would call an LLM (OpenAI, Claude, etc.)
 */
app.post('/summarize', (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text field is required and must be a string' });
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'text must not be empty' });
  }

  const summary = trimmed.length <= 100
    ? trimmed
    : trimmed.slice(0, 100) + '...';

  res.json({ summary });
});

/**
 * POST /evaluate
 * Body: { output: string, criteria: string }
 * Response: { score: number (1-5), reasoning: string }
 *
 * Mock LLM judge: scores the output using simple heuristics.
 * In a real system this would call an LLM with a rubric prompt.
 *
 * Scoring logic:
 *   - Start at score 1
 *   - output.length > 50  → +1 point (has substance)
 *   - output.length > 20  → +1 point (not trivially short)
 *   - ends with punctuation (. ! ?) → +1 point (well-formed sentence)
 *   - contains no repeated words > 3 times → +1 point (not gibberish)
 *   - Score is capped at 5 and floored at 1
 */
app.post('/evaluate', (req, res) => {
  const { output, criteria } = req.body;

  if (output === undefined || output === null) {
    return res.status(400).json({ error: 'output field is required' });
  }

  if (!criteria || typeof criteria !== 'string') {
    return res.status(400).json({ error: 'criteria field is required and must be a string' });
  }

  const text = String(output);
  const reasons = [];
  let score = 1;

  // Criterion 1: output has enough substance (> 50 chars)
  if (text.length > 50) {
    score += 1;
    reasons.push('Output has sufficient length to convey meaning (>50 chars).');
  } else if (text.length > 20) {
    score += 1;
    reasons.push('Output has minimal but some content (>20 chars).');
  } else {
    reasons.push('Output is very short and may lack substance.');
  }

  // Criterion 2: ends with punctuation (well-formed)
  if (/[.!?]$/.test(text.trim())) {
    score += 1;
    reasons.push('Output ends with proper punctuation, indicating a complete sentence.');
  } else {
    reasons.push('Output does not end with punctuation; may be incomplete.');
  }

  // Criterion 3: not gibberish — no single word repeated more than 3 times.
  // Heavy repetition is a strong signal of low quality and overrides length bonuses
  // by applying a -1 penalty, allowing scores to drop below what length alone earned.
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const wordCounts = words.reduce((acc, w) => {
    acc[w] = (acc[w] || 0) + 1;
    return acc;
  }, {});
  const maxRepeat = Math.max(...Object.values(wordCounts), 0);
  if (maxRepeat <= 3) {
    score += 1;
    reasons.push('Output vocabulary is varied with no excessive repetition.');
  } else {
    score -= 1;
    reasons.push(`Output contains repetitive word usage (max repeat: ${maxRepeat}x), suggesting low quality.`);
  }

  // Floor and cap
  score = Math.max(1, Math.min(5, score));

  const reasoning =
    `Evaluated against criteria: "${criteria}". ` +
    reasons.join(' ') +
    ` Final score: ${score}/5.`;

  res.json({ score, reasoning });
});

const PORT = 3011;
app.listen(PORT, () => console.log(`LLM-as-Judge demo server running at http://localhost:${PORT}`));
