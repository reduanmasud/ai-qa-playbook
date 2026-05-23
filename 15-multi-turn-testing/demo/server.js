const express = require('express');
const app = express();
app.use(express.json());

/**
 * In-memory session store.
 * Each session tracks:
 *   - history: array of { role, content } objects
 *   - turnCount: number of messages processed
 *   - userName: stored name if the user introduced themselves
 */
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      history: [],
      turnCount: 0,
      userName: null,
    });
  }
  return sessions.get(sessionId);
}

function resetSession(sessionId) {
  sessions.set(sessionId, {
    history: [],
    turnCount: 0,
    userName: null,
  });
}

/**
 * Extract a name from a message like "my name is Alice" or "I am Bob".
 * Returns the name string or null if no name pattern is found.
 */
function extractName(message) {
  const lower = message.toLowerCase().trim();

  // Patterns: "my name is X", "i am X", "i'm X", "call me X"
  const patterns = [
    /my name is ([a-z][a-z'-]*)/i,
    /\bi am ([a-z][a-z'-]*)/i,
    /\bi'm ([a-z][a-z'-]*)/i,
    /call me ([a-z][a-z'-]*)/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      // Capitalise first letter
      const name = match[1];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  return null;
}

/**
 * Determine if the user is asking for their name.
 */
function isAskingForName(message) {
  const lower = message.toLowerCase().trim();
  return (
    lower.includes('what is my name') ||
    lower.includes("what's my name") ||
    lower.includes('do you know my name') ||
    lower.includes('remember my name') ||
    lower.includes('what was my name') ||
    lower.includes('who am i')
  );
}

/**
 * Determine if the user wants to reset the session.
 */
function isRequestingReset(message) {
  const lower = message.toLowerCase().trim();
  return (
    lower === 'clear session' ||
    lower === 'start over' ||
    lower.includes('forget everything') ||
    lower.includes('reset session') ||
    lower.includes('clear history')
  );
}

/**
 * Generate a mock response based on the message and session state.
 */
function generateResponse(message, session) {
  const lower = message.toLowerCase().trim();

  // Check for reset intent first
  if (isRequestingReset(message)) {
    return "Session cleared. I've forgotten everything we discussed. Let's start fresh!";
  }

  // Check if user is introducing themselves
  const extractedName = extractName(message);
  if (extractedName) {
    session.userName = extractedName;
    return `Nice to meet you, ${extractedName}! I'll remember your name for our conversation.`;
  }

  // Check if user is asking for their name
  if (isAskingForName(message)) {
    if (session.userName) {
      return `Your name is ${session.userName}.`;
    }
    return "I don't know your name yet. You can tell me by saying \"my name is [your name]\".";
  }

  // Greetings (also matches "hi there", "hey there", etc.)
  if (/^(hello|hi|hey|greetings)(\s+(there|friend|everyone))?[\s!.]*$/.test(lower)) {
    if (session.userName) {
      return `Hello, ${session.userName}! How can I help you today?`;
    }
    return 'Hello! How can I help you today?';
  }

  // Farewells
  if (/^(bye|goodbye|see you|farewell)[\s!.]*$/.test(lower)) {
    if (session.userName) {
      return `Goodbye, ${session.userName}! Have a great day!`;
    }
    return 'Goodbye! Have a great day!';
  }

  // Weather topic
  if (lower.includes('weather')) {
    return "I'm a simple assistant and don't have access to real-time weather data, but I'm happy to chat about it!";
  }

  // Colour topic
  if (lower.includes('favorite color') || lower.includes('favourite color') || lower.includes('favorite colour') || lower.includes('favourite colour')) {
    return "I don't have personal preferences, but many people enjoy blue or green. What's yours?";
  }

  // Number / math topic
  if (/\d+\s*[\+\-\*\/]\s*\d+/.test(lower)) {
    try {
      // Very simple safe eval for basic arithmetic only
      const sanitised = lower.replace(/[^0-9+\-*/().\s]/g, '');
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitised})`)();
      return `The answer is ${result}.`;
    } catch {
      return "I'm not sure how to calculate that.";
    }
  }

  // Turn count questions
  if (lower.includes('how many messages') || lower.includes('turn count') || lower.includes('how many turns')) {
    return `We've exchanged ${session.turnCount} messages so far in this session.`;
  }

  // Default echo-style response with context hint
  if (session.userName) {
    return `I heard you, ${session.userName}. You said: "${message}". Is there something specific I can help you with?`;
  }
  return `I heard you. You said: "${message}". Is there something specific I can help you with?`;
}

/**
 * POST /chat
 * Body: { sessionId: string, message: string }
 * Response: { response: string, turnCount: number }
 */
app.post('/chat', (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return res.status(400).json({ error: 'sessionId is required and must be a non-empty string' });
  }

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'message is required and must be a non-empty string' });
  }

  const session = getSession(sessionId);

  // Record the incoming user message
  session.history.push({ role: 'user', content: message });
  session.turnCount += 1;

  // Check for reset BEFORE generating response so the reset takes effect
  const wantsReset = isRequestingReset(message);

  const responseText = generateResponse(message, session);

  if (wantsReset) {
    resetSession(sessionId);
    // The reset response is returned, but the session is now clean
    return res.json({ response: responseText, turnCount: 0 });
  }

  // Record the assistant response
  session.history.push({ role: 'assistant', content: responseText });

  res.json({ response: responseText, turnCount: session.turnCount });
});

/**
 * DELETE /session/:sessionId
 * Clears the session entirely.
 */
app.delete('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  sessions.delete(sessionId);
  res.json({ success: true, message: `Session "${sessionId}" deleted.` });
});

/**
 * GET /session/:sessionId
 * Returns metadata about a session without exposing full history.
 * Response: { turnCount: number, hasName: boolean }
 */
app.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessions.has(sessionId)) {
    return res.json({ turnCount: 0, hasName: false });
  }

  const session = sessions.get(sessionId);
  res.json({
    turnCount: session.turnCount,
    hasName: session.userName !== null,
  });
});

const PORT = 3015;
app.listen(PORT, () => {
  console.log(`Multi-turn testing server running on http://localhost:${PORT}`);
});
