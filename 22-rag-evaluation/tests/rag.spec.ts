import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import testCases from './fixtures/rag-test-cases.json';

// ---------------------------------------------------------------------------
// Types matching demo/server.js response shapes
// ---------------------------------------------------------------------------

interface RetrievedDoc {
  id: string;
  content: string;
  relevanceScore: number;
}

interface QueryResponse {
  answer: string;
  retrievedDocs: RetrievedDoc[];
  contextUsed: string[];
}

interface EvaluationResponse {
  contextPrecision: number;
  contextRecall: number;
  faithfulness: number;
  answerRelevance: number;
}

interface DocumentStoreResponse {
  documents: Array<{
    id: string;
    topic: string;
    content: string;
    keywords: string[];
  }>;
}

interface RagTestCase {
  id: string;
  question: string;
  expectedDocIds: string[];
  groundTruth: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function queryRag(
  request: APIRequestContext,
  question: string
): Promise<{ status: number; body: QueryResponse }> {
  const res = await request.post('/rag/query', { data: { question } });
  const body = (await res.json()) as QueryResponse;
  return { status: res.status(), body };
}

async function evaluateRag(
  request: APIRequestContext,
  payload: {
    question: string;
    answer: string;
    retrievedDocs: RetrievedDoc[];
    groundTruth?: string;
  }
): Promise<{ status: number; body: EvaluationResponse }> {
  const res = await request.post('/rag/evaluate', { data: payload });
  const body = (await res.json()) as EvaluationResponse;
  return { status: res.status(), body };
}

function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// ---------------------------------------------------------------------------
// Test 1: Retrieval precision — JavaScript question → JS doc retrieved
// ---------------------------------------------------------------------------
test('retrieval precision: JavaScript question retrieves the JS document', async ({
  request,
}) => {
  const { status, body } = await queryRag(request, 'What is a JavaScript callback?');

  expect(status).toBe(200);
  expect(body.retrievedDocs).toBeDefined();
  expect(body.retrievedDocs.length).toBeGreaterThan(0);

  const retrievedIds = body.retrievedDocs.map((d) => d.id);
  expect(retrievedIds).toContain('js-001');

  // Precision: the JS doc should be in the results but not irrelevant docs
  // (SQL and HTML docs are completely unrelated to "callback")
  const irrelevantIds = ['sql-001', 'html-001', 'css-001'];
  const irrelevantRetrieved = body.retrievedDocs.filter((d) =>
    irrelevantIds.includes(d.id)
  );
  // At most one unrelated doc (top-2 retrieval may pull in a borderline result)
  expect(irrelevantRetrieved.length).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// Test 2: Retrieval recall — broad "web technologies" question should pull
//         HTML or CSS, demonstrating the retriever can surface multiple topics
// ---------------------------------------------------------------------------
test('retrieval recall: broad web question returns multiple relevant documents', async ({
  request,
}) => {
  // "css flexbox html layout web" hits both html-001 and css-001 keywords
  const { status, body } = await queryRag(
    request,
    'How do CSS flexbox and HTML semantic elements affect web page layout?'
  );

  expect(status).toBe(200);
  expect(body.retrievedDocs.length).toBeGreaterThan(0);

  const retrievedIds = body.retrievedDocs.map((d) => d.id);
  // At least one of the web-topic docs should be present
  const webTopicIds = ['html-001', 'css-001'];
  const webDocsFound = retrievedIds.filter((id) => webTopicIds.includes(id));
  expect(webDocsFound.length).toBeGreaterThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// Test 3: Relevance scores are ordered descending
// ---------------------------------------------------------------------------
test('relevance scores are sorted in descending order', async ({ request }) => {
  const { status, body } = await queryRag(
    request,
    'What is SQL and how do database joins work?'
  );

  expect(status).toBe(200);
  expect(body.retrievedDocs.length).toBeGreaterThan(0);

  const scores = body.retrievedDocs.map((d) => d.relevanceScore);
  for (let i = 0; i < scores.length - 1; i++) {
    expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
  }
});

// ---------------------------------------------------------------------------
// Test 4: Faithfulness — answer should only use content from retrieved docs
// ---------------------------------------------------------------------------
test('faithfulness: answer content is grounded in retrieved documents', async ({
  request,
}) => {
  const question = 'What is Python list comprehension?';
  const { status: qStatus, body: qBody } = await queryRag(request, question);

  expect(qStatus).toBe(200);
  expect(qBody.answer).toBeTruthy();
  expect(qBody.retrievedDocs.length).toBeGreaterThan(0);

  const { status: eStatus, body: metrics } = await evaluateRag(request, {
    question,
    answer: qBody.answer,
    retrievedDocs: qBody.retrievedDocs,
    groundTruth: 'List comprehension provides a concise way to create lists in Python',
  });

  expect(eStatus).toBe(200);
  // Faithfulness should be relatively high since the answer is derived from docs
  expect(metrics.faithfulness).toBeGreaterThanOrEqual(0.5);
});

// ---------------------------------------------------------------------------
// Test 5: contextUsed in query response is non-empty
// ---------------------------------------------------------------------------
test('contextUsed is non-empty for an in-topic question', async ({ request }) => {
  const { status, body } = await queryRag(
    request,
    'How does JavaScript handle asynchronous code with promises?'
  );

  expect(status).toBe(200);
  expect(body.contextUsed).toBeDefined();
  expect(Array.isArray(body.contextUsed)).toBe(true);
  expect(body.contextUsed.length).toBeGreaterThan(0);
  // Each entry should be a valid document ID string
  body.contextUsed.forEach((id) => {
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 6: RAGAS metrics all return values in [0, 1]
// ---------------------------------------------------------------------------
test('all RAGAS evaluation metrics are normalised to [0, 1]', async ({ request }) => {
  const question = 'What is a SQL JOIN operation?';
  const { body: qBody } = await queryRag(request, question);

  const { status, body: metrics } = await evaluateRag(request, {
    question,
    answer: qBody.answer,
    retrievedDocs: qBody.retrievedDocs,
    groundTruth: 'SQL JOINs combine rows from two or more tables based on a related column',
  });

  expect(status).toBe(200);

  const metricNames: Array<keyof EvaluationResponse> = [
    'contextPrecision',
    'contextRecall',
    'faithfulness',
    'answerRelevance',
  ];

  for (const metricName of metricNames) {
    const value = metrics[metricName];
    expect(typeof value).toBe('number');
    expect(isInRange(value, 0, 1)).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Test 7: High faithfulness for a focused on-topic query
// ---------------------------------------------------------------------------
test('faithfulness is >= 0.7 for a focused, single-document query', async ({
  request,
}) => {
  const question = 'How do SQL JOIN operations combine table rows?';
  const { body: qBody } = await queryRag(request, question);

  expect(qBody.retrievedDocs.length).toBeGreaterThan(0);

  const { body: metrics } = await evaluateRag(request, {
    question,
    answer: qBody.answer,
    retrievedDocs: qBody.retrievedDocs,
    groundTruth:
      'SQL JOINs combine rows from two or more tables based on a related column between them',
  });

  expect(metrics.faithfulness).toBeGreaterThanOrEqual(0.7);
});

// ---------------------------------------------------------------------------
// Test 8: Low answer relevance for an off-topic question
// ---------------------------------------------------------------------------
test('answerRelevance is low for an off-topic question about cooking', async ({
  request,
}) => {
  // The document store has no cooking content. The server should return a
  // "not found" answer; even if it matches something tangentially, the
  // answerRelevance metric for a cooking question should be near 0.
  const question = 'What is the best recipe for chocolate chip cookies?';
  const { body: qBody } = await queryRag(request, question);

  // Build evaluation payload — may have empty retrievedDocs or low-scoring ones
  const { body: metrics } = await evaluateRag(request, {
    question,
    answer: qBody.answer,
    retrievedDocs: qBody.retrievedDocs,
  });

  // answerRelevance should be low (< 0.4) because the answer content has
  // nothing to do with cookies/recipes
  expect(metrics.answerRelevance).toBeLessThan(0.4);
});

// ---------------------------------------------------------------------------
// Test 9: Full fixture test cases — RAG + evaluation pipeline for all 3 cases
// ---------------------------------------------------------------------------
const cases = testCases as RagTestCase[];

for (const tc of cases) {
  test(`fixture [${tc.id}]: "${tc.question}" retrieves expected docs and passes evaluation`, async ({
    request,
  }) => {
    // Step 1: Query the RAG pipeline
    const { status: qStatus, body: qBody } = await queryRag(request, tc.question);
    expect(qStatus).toBe(200);
    expect(qBody.answer).toBeTruthy();
    expect(qBody.retrievedDocs.length).toBeGreaterThan(0);

    // Step 2: Assert expected document IDs are present in retrieved results
    const retrievedIds = qBody.retrievedDocs.map((d) => d.id);
    for (const expectedId of tc.expectedDocIds) {
      expect(retrievedIds).toContain(expectedId);
    }

    // Step 3: Run evaluation
    const { status: eStatus, body: metrics } = await evaluateRag(request, {
      question: tc.question,
      answer: qBody.answer,
      retrievedDocs: qBody.retrievedDocs,
      groundTruth: tc.groundTruth,
    });

    expect(eStatus).toBe(200);

    // Step 4: All metrics must be valid numbers in [0, 1]
    const metricNames: Array<keyof EvaluationResponse> = [
      'contextPrecision',
      'contextRecall',
      'faithfulness',
      'answerRelevance',
    ];
    for (const metricName of metricNames) {
      const value = metrics[metricName];
      expect(typeof value).toBe('number');
      expect(isInRange(value, 0, 1)).toBe(true);
    }

    // Step 5: Context recall should be meaningful when ground truth matches
    // the retrieved document's topic (not zero — the doc covers the ground truth)
    expect(metrics.contextRecall).toBeGreaterThan(0);
  });
}

// ---------------------------------------------------------------------------
// Test 10: Document store endpoint returns all 5 documents
// ---------------------------------------------------------------------------
test('GET /rag/documents returns all 5 documents in the store', async ({ request }) => {
  const res = await request.get('/rag/documents');
  expect(res.status()).toBe(200);

  const body = (await res.json()) as DocumentStoreResponse;
  expect(body.documents).toBeDefined();
  expect(Array.isArray(body.documents)).toBe(true);
  expect(body.documents.length).toBe(5);

  // Verify the expected document IDs exist
  const ids = body.documents.map((d) => d.id);
  expect(ids).toContain('js-001');
  expect(ids).toContain('py-001');
  expect(ids).toContain('sql-001');
  expect(ids).toContain('html-001');
  expect(ids).toContain('css-001');
});
