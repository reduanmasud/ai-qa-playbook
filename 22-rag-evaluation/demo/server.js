const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// Document store — 5 hardcoded documents, one per topic
// ---------------------------------------------------------------------------
// Each document has:
//   id            — stable identifier used in retrieval assertions
//   topic         — human-readable category
//   content       — the text the RAG system can quote from
//   keywords      — terms the keyword-match retriever looks for
// ---------------------------------------------------------------------------

const DOCUMENT_STORE = [
  {
    id: 'js-001',
    topic: 'JavaScript',
    content:
      'JavaScript is a high-level, dynamic programming language primarily used for web development. ' +
      'A callback is a function passed as an argument to another function, which is then invoked ' +
      'inside the outer function to complete a routine or action. Callbacks are foundational to ' +
      'asynchronous programming in JavaScript. Promises and async/await are modern alternatives ' +
      'that build on the same concept of deferred execution.',
    keywords: ['javascript', 'callback', 'async', 'promise', 'js', 'function', 'await', 'web'],
  },
  {
    id: 'py-001',
    topic: 'Python',
    content:
      'Python is an interpreted, general-purpose programming language known for readability and ' +
      'simplicity. List comprehension provides a concise way to create lists in Python. The syntax ' +
      'is: [expression for item in iterable if condition]. For example, [x*2 for x in range(10)] ' +
      'creates a list of doubled values. Python also supports dict and set comprehensions with ' +
      'similar syntax.',
    keywords: [
      'python',
      'list',
      'comprehension',
      'iterable',
      'dict',
      'set',
      'range',
      'syntax',
      'interpreted',
    ],
  },
  {
    id: 'sql-001',
    topic: 'SQL',
    content:
      'SQL (Structured Query Language) is used to manage and query relational databases. ' +
      'SQL JOINs combine rows from two or more tables based on a related column between them. ' +
      'INNER JOIN returns rows with matching values in both tables. LEFT JOIN returns all rows ' +
      'from the left table and matched rows from the right. RIGHT JOIN is the mirror of LEFT JOIN. ' +
      'FULL OUTER JOIN returns all rows from both tables.',
    keywords: [
      'sql',
      'join',
      'inner',
      'left',
      'right',
      'outer',
      'table',
      'query',
      'database',
      'relational',
    ],
  },
  {
    id: 'html-001',
    topic: 'HTML',
    content:
      'HTML (HyperText Markup Language) is the standard language for creating web pages. ' +
      'HTML uses elements represented by tags such as <div>, <p>, <a>, and <img>. ' +
      'Semantic HTML elements like <header>, <footer>, <article>, and <section> provide ' +
      'meaning to the structure of the document, improving accessibility and SEO. ' +
      'The DOCTYPE declaration at the top of an HTML file tells the browser which version ' +
      'of HTML is being used.',
    keywords: [
      'html',
      'tag',
      'element',
      'semantic',
      'div',
      'markup',
      'web',
      'browser',
      'doctype',
      'page',
    ],
  },
  {
    id: 'css-001',
    topic: 'CSS',
    content:
      'CSS (Cascading Style Sheets) controls the visual presentation of HTML documents. ' +
      'The box model in CSS describes how every element is represented as a rectangular box ' +
      'with content, padding, border, and margin. Flexbox is a one-dimensional layout method ' +
      'for arranging items in rows or columns. CSS Grid is a two-dimensional layout system ' +
      'that allows precise placement of elements in both rows and columns simultaneously.',
    keywords: [
      'css',
      'style',
      'stylesheet',
      'flexbox',
      'grid',
      'box',
      'padding',
      'margin',
      'layout',
      'visual',
    ],
  },
];

// ---------------------------------------------------------------------------
// Retrieval — keyword overlap scoring
// ---------------------------------------------------------------------------
// Tokenises both the query and the document keywords array, then counts how
// many tokens from the query appear in the document keywords.
// Returns the top-2 documents sorted by score descending (score > 0 only).
// ---------------------------------------------------------------------------

// Common English stop-words that carry no domain signal; filtering them
// prevents false positive matches on words like "is", "the", "for".
const STOP_WORDS = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
  'the', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
  'with', 'from', 'by', 'as', 'it', 'its', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'how', 'when', 'where', 'why',
  'not', 'no', 'so', 'if', 'then', 'than', 'also', 'more', 'most',
  'all', 'both', 'each', 'few', 'many', 'some', 'such', 'very',
  'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'about', 'against', 'same', 'other', 'only', 'own', 'just', 'because',
  'while', 'although', 'however', 'therefore', 'thus',
]);

function tokenise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function computeRelevanceScore(queryTokens, doc) {
  const docKeywordSet = new Set(doc.keywords.map((k) => k.toLowerCase()));
  const contentTokens = tokenise(doc.content);
  const allDocTerms = new Set([...docKeywordSet, ...contentTokens]);

  let matches = 0;
  for (const token of queryTokens) {
    if (allDocTerms.has(token)) matches++;
  }

  // Normalise by number of query tokens so score is in [0, 1]
  const rawScore = queryTokens.length > 0 ? matches / queryTokens.length : 0;

  // Apply a mild boost when the topic word itself appears verbatim in the query
  const topicBoost = queryTokens.includes(doc.topic.toLowerCase()) ? 0.15 : 0;

  return Math.min(1, rawScore + topicBoost);
}

function retrieveDocuments(question, topK = 2) {
  const queryTokens = tokenise(question);

  const scored = DOCUMENT_STORE.map((doc) => ({
    ...doc,
    relevanceScore: computeRelevanceScore(queryTokens, doc),
  }));

  // Sort by score descending, take topK with a score above 0
  return scored
    .filter((d) => d.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);
}

// ---------------------------------------------------------------------------
// Answer generation — concatenates relevant sentences from matched docs
// ---------------------------------------------------------------------------

function generateAnswer(question, retrievedDocs) {
  if (retrievedDocs.length === 0) {
    return "I couldn't find relevant information in the knowledge base to answer your question.";
  }

  const questionTokens = new Set(tokenise(question));

  // Pick sentences from retrieved docs that share tokens with the question
  const relevantSentences = [];
  for (const doc of retrievedDocs) {
    const sentences = doc.content
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);

    for (const sentence of sentences) {
      const sentenceTokens = tokenise(sentence);
      const overlap = sentenceTokens.filter((t) => questionTokens.has(t)).length;
      if (overlap > 0) {
        relevantSentences.push({ sentence, overlap });
      }
    }
  }

  if (relevantSentences.length === 0) {
    // Fall back to first two sentences from the top doc
    const fallback = retrievedDocs[0].content
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(' ');
    return fallback;
  }

  // Sort by overlap then take up to 3 sentences
  const topSentences = relevantSentences
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map((s) => s.sentence);

  return topSentences.join(' ');
}

// ---------------------------------------------------------------------------
// RAGAS-style evaluation heuristics
// ---------------------------------------------------------------------------
// These are mock implementations that approximate the real RAGAS metrics:
//
//   contextPrecision  — of the retrieved docs, what fraction are actually
//                       relevant to the question?
//   contextRecall     — of the information needed to answer, what fraction
//                       is covered by the retrieved docs?
//   faithfulness      — does the generated answer stay within the retrieved
//                       context (no hallucination)?
//   answerRelevance   — how relevant is the answer to the original question?
// ---------------------------------------------------------------------------

function evaluateContextPrecision(question, retrievedDocs) {
  if (retrievedDocs.length === 0) return 0;
  const queryTokens = new Set(tokenise(question));

  let relevantCount = 0;
  for (const doc of retrievedDocs) {
    const docContent = (doc.content || '').toLowerCase();
    const matchCount = [...queryTokens].filter((t) => docContent.includes(t)).length;
    const docRelevance = matchCount / Math.max(queryTokens.size, 1);
    if (docRelevance > 0.05) relevantCount++;
  }

  return relevantCount / retrievedDocs.length;
}

function evaluateContextRecall(groundTruth, retrievedDocs) {
  if (!groundTruth || retrievedDocs.length === 0) return 0;

  const groundTruthTokens = tokenise(groundTruth);
  if (groundTruthTokens.length === 0) return 0;

  const allDocContent = retrievedDocs.map((d) => d.content || '').join(' ').toLowerCase();
  const covered = groundTruthTokens.filter((t) => allDocContent.includes(t)).length;

  return covered / groundTruthTokens.length;
}

function evaluateFaithfulness(answer, retrievedDocs) {
  if (!answer || retrievedDocs.length === 0) return 0;

  const answerTokens = tokenise(answer);
  if (answerTokens.length === 0) return 1; // Empty answer has nothing unfaithful

  const allDocContent = retrievedDocs.map((d) => d.content || '').join(' ').toLowerCase();
  const supportedTokens = answerTokens.filter((t) => allDocContent.includes(t)).length;

  // Penalise if the answer mentions topic keywords completely absent from retrieved docs.
  // Guard against docs that arrive without a `keywords` array (e.g. slim response payloads
  // from /rag/query that only carry id, content, relevanceScore).
  const answerTopicMentions = [...allTopicKeywords()].filter((kw) =>
    answer.toLowerCase().includes(kw)
  );
  const unsupportedTopicMentions = answerTopicMentions.filter(
    (kw) => !isTopicCoveredByDocs(kw, retrievedDocs)
  );
  const topicPenalty = Math.min(0.3, unsupportedTopicMentions.length * 0.1);

  const baseScore = supportedTokens / answerTokens.length;
  return Math.max(0, Math.min(1, baseScore - topicPenalty));
}

function allTopicKeywords() {
  return new Set(DOCUMENT_STORE.flatMap((d) => d.keywords));
}

function isTopicCoveredByDocs(keyword, retrievedDocs) {
  return retrievedDocs.some((doc) => {
    // Use the doc's own keywords if present; otherwise fall back to the
    // full store record (so slim response payloads still work correctly).
    const keywords =
      doc.keywords ||
      (DOCUMENT_STORE.find((d) => d.id === doc.id) || {}).keywords ||
      [];
    return keywords.some((k) => k.toLowerCase() === keyword);
  });
}

function evaluateAnswerRelevance(question, answer) {
  if (!answer || !question) return 0;

  const questionTokens = tokenise(question);
  const answerTokens = tokenise(answer);

  if (questionTokens.length === 0 || answerTokens.length === 0) return 0;

  const answerTokenSet = new Set(answerTokens);
  const overlap = questionTokens.filter((t) => answerTokenSet.has(t)).length;

  // Jaccard-like score: intersection / union
  const union = new Set([...questionTokens, ...answerTokens]).size;
  const intersection = overlap;

  const jaccardScore = intersection / union;

  // Boost when answer length is proportional to question complexity
  const lengthBonus = Math.min(0.2, answerTokens.length / 50);

  return Math.min(1, jaccardScore + lengthBonus);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /rag/documents — returns all documents in the store
app.get('/rag/documents', (_req, res) => {
  res.json({ documents: DOCUMENT_STORE });
});

// POST /rag/query — retrieval + answer generation
app.post('/rag/query', (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ error: 'question is required and must be a non-empty string' });
  }

  const retrievedDocs = retrieveDocuments(question);
  const answer = generateAnswer(question, retrievedDocs);
  const contextUsed = retrievedDocs.map((d) => d.id);

  const responseRetrievedDocs = retrievedDocs.map(({ id, content, relevanceScore }) => ({
    id,
    content,
    relevanceScore,
  }));

  res.json({
    answer,
    retrievedDocs: responseRetrievedDocs,
    contextUsed,
  });
});

// POST /rag/evaluate — mock RAGAS-style metric computation
app.post('/rag/evaluate', (req, res) => {
  const { question, answer, retrievedDocs, groundTruth } = req.body;

  if (!question || !answer || !Array.isArray(retrievedDocs)) {
    return res.status(400).json({
      error: 'question, answer, and retrievedDocs (array) are required',
    });
  }

  const contextPrecision = evaluateContextPrecision(question, retrievedDocs);
  const contextRecall = evaluateContextRecall(groundTruth || '', retrievedDocs);
  const faithfulness = evaluateFaithfulness(answer, retrievedDocs);
  const answerRelevance = evaluateAnswerRelevance(question, answer);

  res.json({
    contextPrecision: parseFloat(contextPrecision.toFixed(4)),
    contextRecall: parseFloat(contextRecall.toFixed(4)),
    faithfulness: parseFloat(faithfulness.toFixed(4)),
    answerRelevance: parseFloat(answerRelevance.toFixed(4)),
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = 3022;
app.listen(PORT, () => {
  console.log(`RAG Evaluation demo server running on http://localhost:${PORT}`);
});
