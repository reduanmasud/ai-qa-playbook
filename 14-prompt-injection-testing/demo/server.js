const express = require('express');
const app = express();
app.use(express.json());

/**
 * Injection detection patterns.
 *
 * The server normalises unicode characters to their ASCII equivalents before
 * checking, which defeats homoglyph / small-caps bypass attempts.
 *
 * Patterns are matched against the lower-cased, unicode-normalised message.
 */
const INJECTION_PATTERNS = [
  'ignore previous instructions',
  'ignore all previous instructions',
  'ignore instructions',
  'disregard',
  'forget your instructions',
  'forget all instructions',
  'forget instructions',
  'you are now',
  'act as',
  'pretend you are',
  'pretend to be',
  'jailbreak',
  'override instructions',
  'new instructions',
  'system prompt',
  'your instructions are',
  'ignore the above',
  'ignore the system',
  'do not follow',
];

/**
 * Normalise unicode to its ASCII base form.
 *
 * This catches homoglyph attacks that use look-alike unicode characters
 * (e.g. ɪɢɴᴏʀᴇ → ignore).
 *
 * NFD decomposition followed by stripping the combining diacritics covers
 * accented characters. The additional transliteration table covers the small-
 * caps / letterlike unicode block commonly used in prompt injection bypasses.
 */
function normaliseUnicode(text) {
  // Map small-caps and letterlike unicode to their ASCII equivalents.
  const SMALL_CAPS_MAP = {
    ɪ: 'i', ɢ: 'g', ɴ: 'n', ᴏ: 'o', ʀ: 'r', ᴇ: 'e', ᴘ: 'p', ʀ: 'r',
    ᴠ: 'v', ɪ: 'i', ᴏ: 'o', ᴜ: 'u', s: 's', ɪ: 'i', ɴ: 'n', sᴛ: 'st',
    ʀᴜ: 'ru', ᴄ: 'c', ᴛ: 't', ɪᴏ: 'io', ɴs: 'ns',
    ᴀ: 'a', ʙ: 'b', ᴅ: 'd', ꜰ: 'f', ʜ: 'h', ᴊ: 'j', ᴋ: 'k', ʟ: 'l',
    ᴍ: 'm', ǫ: 'q', sᴛʀ: 'str', ᴡ: 'w', x: 'x', ʏ: 'y', ᴢ: 'z',
  };

  // Replace known small-caps characters first.
  let result = '';
  for (const char of text) {
    result += SMALL_CAPS_MAP[char] ?? char;
  }

  // Then apply NFD + strip combining marks for accented characters.
  return result.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Detect prompt injection in a string.
 * Returns true if any known injection pattern is found.
 */
function detectInjection(text) {
  const normalised = normaliseUnicode(text);
  return INJECTION_PATTERNS.some((pattern) => normalised.includes(pattern));
}

/**
 * Detect injection patterns in document text.
 * Documents may carry indirect injections hidden in content the AI is asked
 * to process (e.g. HTML comments, invisible text, footnotes).
 */
function detectDocumentInjection(documentText) {
  // Scan the full document text including HTML comment bodies.
  // HTML comments (<!-- ... -->) are a classic indirect injection vector:
  // they are invisible to human readers but visible to the AI when fed as
  // document context. We do NOT strip them before checking — we want to
  // detect injection patterns wherever they hide in the document.
  const normalised = normaliseUnicode(documentText);
  return INJECTION_PATTERNS.some((pattern) => normalised.includes(pattern));
}

// ---------------------------------------------------------------------------
// POST /chat
// Body:    { userMessage: string, systemPrompt: string }
// Returns: { response: string, blocked: boolean }
// ---------------------------------------------------------------------------
app.post('/chat', (req, res) => {
  const { userMessage, systemPrompt } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  const blocked = detectInjection(userMessage);

  if (blocked) {
    return res.json({
      response: 'Request blocked: potential prompt injection detected',
      blocked: true,
    });
  }

  // Safe response: never echo the system prompt back.
  // The response is constructed only from the safe, sanitised user message
  // preview — the system prompt is intentionally excluded.
  const safePreview = userMessage.substring(0, 50).replace(/[<>]/g, '');
  return res.json({
    response: `I am a helpful assistant. ${safePreview}`,
    blocked: false,
  });
});

// ---------------------------------------------------------------------------
// POST /process-document
// Body:    { document: string, instruction: string }
// Returns: { result: string, injectionDetected: boolean }
// ---------------------------------------------------------------------------
app.post('/process-document', (req, res) => {
  const { document, instruction } = req.body;

  if (!document || !instruction) {
    return res.status(400).json({ error: 'document and instruction are required' });
  }

  const injectionDetected = detectDocumentInjection(document);

  if (injectionDetected) {
    return res.json({
      result: 'Document processing halted: injection pattern detected in document content',
      injectionDetected: true,
    });
  }

  // Summarise the document safely (mock implementation).
  const wordCount = document.trim().split(/\s+/).length;
  return res.json({
    result: `Document processed successfully. Word count: ${wordCount}. Instruction applied: "${instruction.substring(0, 40)}".`,
    injectionDetected: false,
  });
});

app.listen(3014, () => console.log('Prompt injection testing server at http://localhost:3014'));
