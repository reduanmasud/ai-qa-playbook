const express = require('express');
const app = express();
app.use(express.json());

/**
 * POST /qa
 * Body: { context: string, question: string }
 * Returns: { answer: string }
 *
 * Mock QA system: extracts key words from the question and looks for them
 * in the context to compose an answer. For 20% of requests it fabricates
 * a plausible-sounding but unsupported statistic.
 */
app.post('/qa', (req, res) => {
  const { context, question } = req.body;

  if (!context || !question) {
    return res.status(400).json({ error: 'context and question are required' });
  }

  // 20% of the time fabricate a statistic regardless of what the context says
  if (Math.random() < 0.2) {
    return res.json({
      answer: 'The study showed 94% success rate, making it highly effective.',
    });
  }

  // Find content-words from the question that appear in the context
  const contextLower = context.toLowerCase();
  const questionWords = question
    .toLowerCase()
    .replace(/[?.,!]/g, '')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !['what', 'when', 'where', 'which', 'does', 'this', 'that', 'with', 'from', 'have', 'about'].includes(w)
    );

  const matchedWords = questionWords.filter((w) => contextLower.includes(w));

  if (matchedWords.length === 0) {
    return res.json({
      answer: "I could not find relevant information in the provided context to answer that question.",
    });
  }

  // Extract the sentence(s) from context that contain the most matched words.
  // Split on sentence-ending punctuation OR newlines, and discard very short
  // fragments (like headings) that lack a verb.
  const sentences = context
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const scored = sentences.map((sentence) => {
    const sentLower = sentence.toLowerCase();
    const score = matchedWords.filter((w) => sentLower.includes(w)).length;
    return { sentence, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topSentences = scored
    .filter((s) => s.score > 0)
    .slice(0, 2)
    .map((s) => s.sentence);

  if (topSentences.length === 0) {
    return res.json({
      answer: "Based on the context, no specific information addresses your question.",
    });
  }

  res.json({ answer: topSentences.join(' ') });
});

/**
 * POST /check-grounding
 * Body: { context: string, answer: string }
 * Returns: { grounded: boolean, unsupportedClaims: string[] }
 *
 * Mock grounding checker: finds numeric values and distinctive phrases in
 * the answer and checks whether they appear in the context. Any that are
 * absent are reported as unsupported claims.
 *
 * Normalisation: both sides are lower-cased and non-alphanumeric characters
 * (except spaces) are replaced with spaces before phrase matching, so that
 * punctuation differences do not cause false positives.
 */
app.post('/check-grounding', (req, res) => {
  const { context, answer } = req.body;

  if (!context || !answer) {
    return res.status(400).json({ error: 'context and answer are required' });
  }

  /** Normalise text: lowercase, replace non-alphanumeric with space, collapse spaces */
  function normalise(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const contextNorm = normalise(context);
  const unsupportedClaims = [];

  // Check every numeric token in the answer (e.g. "94%", "42", "3.5")
  const numericPattern = /\d+(?:\.\d+)?%?/g;
  const answerNumbers = [...answer.matchAll(numericPattern)].map((m) => m[0]);

  for (const num of answerNumbers) {
    // Strip trailing % for the context look-up so "85%" matches "85" in context too
    const bare = num.replace('%', '');
    if (!contextNorm.includes(bare)) {
      unsupportedClaims.push(`Number not found in context: "${num}"`);
    }
  }

  // Split the answer into individual sentences before building phrase windows
  // so phrases never span two different sentences.
  const answerSentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sentence of answerSentences) {
    // Use ALL words (not just long ones) to preserve natural adjacency
    const words = normalise(sentence).split(' ').filter((w) => w.length > 0);

    // Slide a window of 4 consecutive words within the same sentence.
    // Using 4-grams reduces false positives from common 3-word patterns.
    for (let i = 0; i <= words.length - 4; i++) {
      const phrase = words.slice(i, i + 4).join(' ');
      if (!contextNorm.includes(phrase)) {
        // Report only the first unmatched phrase per sentence to keep output concise
        unsupportedClaims.push(`Phrase not found in context: "${phrase}"`);
        break;
      }
    }
  }

  // Deduplicate
  const unique = [...new Set(unsupportedClaims)];

  res.json({
    grounded: unique.length === 0,
    unsupportedClaims: unique,
  });
});

app.listen(3013, () => console.log('Hallucination detection server at http://localhost:3013'));
