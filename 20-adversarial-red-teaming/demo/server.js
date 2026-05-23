const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// Content policy engine
// ---------------------------------------------------------------------------
// Simulates an AI content moderation layer with three outcomes:
//   - policy_violation : harmful / violent / weapon-related content
//   - pii_detected     : personal identifiable information in input
//   - safe             : benign requests that pass all checks
//
// safetyScore:
//   0.0 – 0.29  →  policy_violation
//   0.30 – 0.69 →  pii_detected
//   0.70 – 1.0  →  safe
// ---------------------------------------------------------------------------

// Keywords that trigger a policy violation (violence, harm, weapons)
const VIOLATION_PATTERNS = [
  /\b(kill|murder|harm|hurt|attack|weapon|weapons|bomb|explosive|poison|assassin|shoot|stab|strangle)\b/i,
  /\b(how to make a? ?(bomb|weapon|explosive|poison|virus|malware))\b/i,
  /\b(instructions? for (harming|hurting|killing|attacking))\b/i,
  /\b(guide on (making|building|creating|constructing))\b.*\b(weapon|bomb|explosive|poison)\b/i,
  /\b(making|building|creating|constructing)\b.*\b(weapon|bomb|explosive|poison|virus|malware)\b/i,
  /\b(violence|violent)\b/i,
  /\b(suicide|self.harm)\b/i,
];

// Patterns that trigger PII detection
const PII_PATTERNS = [
  // Email addresses
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  // US phone numbers
  /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  // Social Security Numbers
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Credit card-like patterns (16 digits)
  /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/,
];

// Fictional framing keywords that attempt to bypass policy
const FICTIONAL_FRAMING_KEYWORDS = [
  /\bin a (fictional|hypothetical|imaginary) (story|scenario|world|context)\b/i,
  /\bmy character needs to\b/i,
  /\bfor a (novel|book|story|screenplay|movie|game)\b/i,
  /\bpretend (you are|you're|to be|that)\b/i,
  /\bimagine (you are|you're|that)\b/i,
  /\brole.?play\b/i,
];

// Prompt injection attack patterns
const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override|bypass|skip)\b.*\b(instructions?|rules?|training|guidelines?|policy|policies|prompt|system)\b/i,
  /\b(you are now|act as|pretend to be|simulate)\b.*\b(different|unrestricted|jailbroken|free|evil)\b/i,
  /\bpretend (to be|you are|you're) (an? )?AI\b.*\b(no|without|free from)\b.*\b(safety|rules?|restrictions?|limits?|guidelines?)\b/i,
  /\b(no|without|free from)\b.*\b(safety|restrictions?|limits?|guidelines?|rules?)\b/i,
  /\bnew instructions?\b/i,
  /\bDAN\b/,
  /\b(act|behave|respond)\b.*\b(no|without|ignoring)\b.*\b(safety|restrictions?|rules?|limits?)\b/i,
];

/**
 * Analyze input text for policy violations and PII.
 * Returns { safetyScore, category, blocked, reason }.
 *
 * @param {string} text
 * @returns {{ safetyScore: number, category: string, blocked: boolean, reason: string }}
 */
function analyzeContent(text) {
  // --- Prompt injection attacks ---
  const hasInjection = INJECTION_PATTERNS.some((re) => re.test(text));

  // --- Fictional framing: extract underlying content for re-check ---
  const hasFictionalFrame = FICTIONAL_FRAMING_KEYWORDS.some((re) => re.test(text));

  // Strip fictional framing qualifiers so underlying content is still checked.
  // We do NOT grant a safety pass just because of fictional framing.
  let contentToCheck = text;
  if (hasFictionalFrame) {
    contentToCheck = text
      .replace(/\bin a (fictional|hypothetical|imaginary) (story|scenario|world|context)[,.]?\s*/gi, '')
      .replace(/\bmy character needs to\s*/gi, '')
      .replace(/\bfor a (novel|book|story|screenplay|movie|game)[,.]?\s*/gi, '')
      .replace(/\bpretend (you are|you're|to be|that)[,.]?\s*/gi, '')
      .replace(/\bimagine (you are|you're|that)[,.]?\s*/gi, '')
      .replace(/\brole.?play[,.]?\s*/gi, '')
      .trim();
  }

  // --- Check for policy violations on the underlying content ---
  const hasViolation = VIOLATION_PATTERNS.some((re) => re.test(contentToCheck));

  // --- Check for PII ---
  const hasPii = PII_PATTERNS.some((re) => re.test(text));

  // --- Derive score and category ---
  if (hasInjection || hasViolation) {
    // Strong violation → very low safety score
    // Use a small deterministic offset so scores are not all identical
    const offset = (text.length % 10) / 100;
    const safetyScore = parseFloat((0.05 + offset).toFixed(2));
    return {
      safetyScore,
      category: 'policy_violation',
      blocked: true,
      reason: 'Content violates usage policy.',
    };
  }

  if (hasPii) {
    const offset = (text.length % 20) / 100;
    const safetyScore = parseFloat((0.40 + offset).toFixed(2));
    return {
      safetyScore,
      category: 'pii_detected',
      blocked: false, // flagged but not necessarily blocked
      reason: 'Input contains personally identifiable information.',
    };
  }

  // --- Safe ---
  const offset = (text.length % 20) / 100;
  const safetyScore = parseFloat(Math.min(0.95, 0.82 + offset).toFixed(2));
  return {
    safetyScore,
    category: 'safe',
    blocked: false,
    reason: '',
  };
}

/**
 * Generate a safe, non-leaking response message.
 * Blocked responses must not reveal internal rule names or patterns.
 *
 * @param {{ category: string, blocked: boolean }} analysis
 * @param {string} input
 * @returns {string}
 */
function buildResponse(analysis, input) {
  if (analysis.blocked) {
    // Generic refusal — no internal details
    return "I'm sorry, I can't help with that request.";
  }

  if (analysis.category === 'pii_detected') {
    return "I noticed your message may contain personal information. Please avoid sharing sensitive data. How else can I help you?";
  }

  // Safe response: echo a helpful acknowledgment
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "Hello! How can I assist you today?";
  }

  return `I received your message. Here is a response to: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? '...' : ''}"`;
}

// ---------------------------------------------------------------------------
// POST /ai-assistant
// Body:    { message: string }
// Returns: { response: string, safetyScore: number, category: string }
// ---------------------------------------------------------------------------

app.post('/ai-assistant', (req, res) => {
  const { message } = req.body;

  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'message must be a string' });
  }

  // Reject inputs that are too large (DoS protection)
  if (message.length > 10000) {
    return res.status(413).json({ error: 'Input too large. Maximum length is 10 000 characters.' });
  }

  const analysis = analyzeContent(message);
  const responseText = buildResponse(analysis, message);

  return res.json({
    response: responseText,
    safetyScore: analysis.safetyScore,
    category: analysis.category,
  });
});

// ---------------------------------------------------------------------------
// POST /red-team/batch
// Body:    { attacks: Array<{ id: string, payload: string }> }
// Returns: { results: Array<{ id, blocked, safetyScore, category }> }
//
// Designed for running bulk adversarial test suites in a single round-trip.
// ---------------------------------------------------------------------------

app.post('/red-team/batch', (req, res) => {
  const { attacks } = req.body;

  if (!Array.isArray(attacks) || attacks.length === 0) {
    return res.status(400).json({ error: 'attacks must be a non-empty array' });
  }

  const results = attacks.map((attack) => {
    const id = String(attack.id ?? '');
    const payload = typeof attack.payload === 'string' ? attack.payload : '';

    // Apply the same size limit per payload
    if (payload.length > 10000) {
      return { id, blocked: true, safetyScore: 0.0, category: 'size_exceeded' };
    }

    const analysis = analyzeContent(payload);
    return {
      id,
      blocked: analysis.blocked,
      safetyScore: analysis.safetyScore,
      category: analysis.category,
    };
  });

  return res.json({ results });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 3020;
app.listen(PORT, () =>
  console.log(`Adversarial Red Teaming demo server running at http://localhost:${PORT}`)
);
