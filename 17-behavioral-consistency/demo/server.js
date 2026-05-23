const express = require('express');
const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Mock AI answer engine
// ---------------------------------------------------------------------------
// In a real system, this calls an LLM (OpenAI, Claude, etc.).
// Here we simulate:
//   - Non-determinism via seed: same seed → same answer text
//   - Consistent labelling: label is derived from question topic, not phrasing
//   - Slight surface-level variation so string equality tests would fail
// ---------------------------------------------------------------------------

/**
 * Detect the topic of a question string.
 * Returns { label, baseAnswer }.
 *
 * @param {string} question
 * @returns {{ label: string, baseAnswer: string } | null}
 */
function classify(question) {
  const q = question.toLowerCase().trim();

  // Geography — capital of France variants
  if (
    q.includes('capital of france') ||
    q.includes("france's capital") ||
    q.includes('france capital') ||
    q.includes('paris is capital') ||
    q.includes('capital city of france') ||
    q.includes('what city is the capital') && q.includes('france') ||
    q.includes('capital city france') ||
    q.includes('french capital') ||
    (q.includes('paris') && q.includes('capital')) ||
    (q.includes('france') && q.includes('capital'))
  ) {
    return {
      label: 'geography',
      baseAnswer: 'The capital of France is Paris.',
    };
  }

  // Math — 2+2 variants
  if (
    q.includes('2 + 2') ||
    q.includes('2+2') ||
    q.includes('two plus two') ||
    q.includes('two and two') ||
    q.includes('add two and two') ||
    q.includes('2 plus 2') ||
    q.includes('sum of 2 and 2') ||
    q.includes('what is 2+2') ||
    q.includes('what is 2 + 2') ||
    (q.includes('2') && q.includes('2') && (q.includes('plus') || q.includes('add') || q.includes('sum') || q.includes('equal')))
  ) {
    return {
      label: 'math',
      baseAnswer: '4',
    };
  }

  // Programming — Python syntax variants
  if (
    q.includes('python') ||
    q.includes('def ') ||
    q.includes('function in python') ||
    q.includes('list comprehension') ||
    q.includes('for loop') ||
    q.includes('how to print') ||
    q.includes('variable in python') ||
    q.includes('syntax for') ||
    q.includes('code in python') ||
    q.includes('python syntax')
  ) {
    return {
      label: 'programming',
      baseAnswer: 'In Python, you define a function using the `def` keyword.',
    };
  }

  return null;
}

/**
 * Apply seed-based variation to an answer string.
 * Different seeds produce slightly different surface forms, but all
 * convey the same semantic content — simulating temperature variation.
 *
 * @param {string} base
 * @param {number} seed
 * @returns {string}
 */
function varyAnswer(base, seed) {
  const normalized = seed % 4; // 4 surface forms per answer

  // Geography variations
  if (base === 'The capital of France is Paris.') {
    const variants = [
      'The capital of France is Paris.',
      'Paris is the capital city of France.',
      'France\'s capital city is Paris.',
      'Paris serves as the capital of France.',
    ];
    return variants[normalized];
  }

  // Math — always exactly "4" regardless of seed
  if (base === '4') {
    return '4';
  }

  // Programming variations
  if (base.startsWith('In Python')) {
    const variants = [
      'In Python, you define a function using the `def` keyword.',
      'Python functions are declared with the `def` keyword.',
      'Use `def` to define a function in Python.',
      'The `def` keyword is used to create functions in Python.',
    ];
    return variants[normalized];
  }

  return base;
}

// ---------------------------------------------------------------------------
// POST /answer
// Body: { question: string, seed?: number }
// Response: { answer: string, label: string }
// ---------------------------------------------------------------------------

app.post('/answer', (req, res) => {
  const { question, seed } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'question field is required and must be a non-empty string' });
  }

  const classified = classify(question);

  if (!classified) {
    // Unrecognised question — return a fallback with label "unknown"
    return res.json({
      answer: 'I am not sure about that.',
      label: 'unknown',
    });
  }

  const effectiveSeed = typeof seed === 'number' ? seed : Math.floor(Math.random() * 4);
  const answer = varyAnswer(classified.baseAnswer, effectiveSeed);

  return res.json({ answer, label: classified.label });
});

// ---------------------------------------------------------------------------
// POST /batch-answer
// Body: { questions: string[] }
// Response: { results: Array<{ question: string, answer: string, label: string }> }
// ---------------------------------------------------------------------------

app.post('/batch-answer', (req, res) => {
  const { questions } = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions must be a non-empty array of strings' });
  }

  const results = questions.map((question, index) => {
    if (typeof question !== 'string' || question.trim().length === 0) {
      return { question, answer: '', label: 'error' };
    }

    const classified = classify(question);
    if (!classified) {
      return { question, answer: 'I am not sure about that.', label: 'unknown' };
    }

    // Use index as a pseudo-seed so batch results have slight variation
    const answer = varyAnswer(classified.baseAnswer, index);
    return { question, answer, label: classified.label };
  });

  return res.json({ results });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 3017;
app.listen(PORT, () =>
  console.log(`Behavioral Consistency demo server running at http://localhost:${PORT}`)
);
