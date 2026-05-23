const express = require('express');

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// In-memory trace store
// ---------------------------------------------------------------------------

/** @type {Map<string, import('./types').Trace>} */
const traceStore = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a random hex ID of the given byte length.
 * @param {number} bytes
 * @returns {string}
 */
function randomId(bytes = 8) {
  let id = '';
  for (let i = 0; i < bytes * 2; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

/**
 * Simulate an async operation that takes `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a completed span object.
 *
 * @param {string} name
 * @param {number} startTime  Unix timestamp in ms
 * @param {number} endTime    Unix timestamp in ms
 * @param {Record<string, unknown>} attributes
 * @param {'ok'|'error'} status
 * @returns {import('./types').Span}
 */
function buildSpan(name, startTime, endTime, attributes, status = 'ok') {
  return {
    spanId: randomId(8),
    name,
    startTime,
    endTime,
    durationMs: endTime - startTime,
    attributes,
    status,
  };
}

// ---------------------------------------------------------------------------
// Mock agent pipeline
// Runs three sequential steps: plan → tool_call → synthesize
// Returns { result, spans }
// ---------------------------------------------------------------------------

/**
 * @param {string} task
 * @returns {Promise<{ result: string, spans: import('./types').Span[] }>}
 */
async function runAgentPipeline(task) {
  const spans = [];

  // ── Span 1: agent.plan ─────────────────────────────────────────────────
  const planStart = Date.now();
  await delay(20 + Math.floor(Math.random() * 30));
  const planEnd = Date.now();
  spans.push(
    buildSpan(
      'agent.plan',
      planStart,
      planEnd,
      {
        task,
        model: 'mock-agent-v1',
        planning_strategy: 'chain-of-thought',
        steps_identified: 2,
      },
      'ok',
    ),
  );

  // ── Span 2: agent.tool_call ─────────────────────────────────────────────
  const toolStart = Date.now();
  await delay(30 + Math.floor(Math.random() * 40));
  const toolEnd = Date.now();
  spans.push(
    buildSpan(
      'agent.tool_call',
      toolStart,
      toolEnd,
      {
        task,
        tool_name: 'web_search',
        tool_input: `search: ${task}`,
        tool_output_tokens: 128,
        cache_hit: false,
      },
      'ok',
    ),
  );

  // ── Span 3: agent.synthesize ────────────────────────────────────────────
  const synthStart = Date.now();
  await delay(15 + Math.floor(Math.random() * 25));
  const synthEnd = Date.now();
  spans.push(
    buildSpan(
      'agent.synthesize',
      synthStart,
      synthEnd,
      {
        task,
        output_tokens: 64,
        finish_reason: 'stop',
        confidence: 0.92,
      },
      'ok',
    ),
  );

  return {
    result: `Completed task: "${task}". Steps executed: plan, tool_call, synthesize.`,
    spans,
  };
}

/**
 * Same pipeline but the tool_call step fails, producing an error span.
 *
 * @param {string} task
 * @returns {Promise<{ result: string, spans: import('./types').Span[] }>}
 */
async function runAgentPipelineWithError(task) {
  const spans = [];

  // ── Span 1: agent.plan ─────────────────────────────────────────────────
  const planStart = Date.now();
  await delay(20 + Math.floor(Math.random() * 20));
  const planEnd = Date.now();
  spans.push(
    buildSpan(
      'agent.plan',
      planStart,
      planEnd,
      {
        task,
        model: 'mock-agent-v1',
        planning_strategy: 'chain-of-thought',
        steps_identified: 2,
      },
      'ok',
    ),
  );

  // ── Span 2: agent.tool_call (fails) ────────────────────────────────────
  const toolStart = Date.now();
  await delay(25 + Math.floor(Math.random() * 20));
  const toolEnd = Date.now();
  spans.push(
    buildSpan(
      'agent.tool_call',
      toolStart,
      toolEnd,
      {
        task,
        tool_name: 'web_search',
        tool_input: `search: ${task}`,
        error_code: 'TOOL_TIMEOUT',
        error_message: 'Tool execution timed out after 5000ms',
      },
      'error',
    ),
  );

  // ── Span 3: agent.synthesize (partial — agent attempts recovery) ────────
  const synthStart = Date.now();
  await delay(10 + Math.floor(Math.random() * 15));
  const synthEnd = Date.now();
  spans.push(
    buildSpan(
      'agent.synthesize',
      synthStart,
      synthEnd,
      {
        task,
        output_tokens: 20,
        finish_reason: 'error_recovery',
        partial_result: true,
      },
      'ok',
    ),
  );

  return {
    result: `Task "${task}" failed mid-execution due to tool timeout. Partial result returned.`,
    spans,
  };
}

/**
 * Persist a completed trace to the in-memory store and return the trace object.
 *
 * @param {string} task
 * @param {import('./types').Span[]} spans
 * @returns {import('./types').Trace}
 */
function storeTrace(task, spans) {
  const traceId = randomId(16);
  const totalDurationMs = spans.reduce((sum, s) => sum + s.durationMs, 0);

  /** @type {import('./types').Trace} */
  const trace = {
    traceId,
    task,
    spans,
    totalDurationMs,
    createdAt: Date.now(),
  };

  traceStore.set(traceId, trace);
  return trace;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /agent/run
app.post('/agent/run', async (req, res) => {
  const { task } = req.body;

  if (!task || typeof task !== 'string' || task.trim().length === 0) {
    return res.status(400).json({ error: 'task field is required and must be a non-empty string' });
  }

  try {
    const { result, spans } = await runAgentPipeline(task.trim());
    const trace = storeTrace(task.trim(), spans);

    return res.json({ result, traceId: trace.traceId });
  } catch (err) {
    return res.status(500).json({ error: 'Agent execution failed', details: String(err) });
  }
});

// POST /agent/run-with-error
app.post('/agent/run-with-error', async (req, res) => {
  const { task } = req.body;
  const effectiveTask = (task && typeof task === 'string' && task.trim()) || 'error-test-task';

  try {
    const { result, spans } = await runAgentPipelineWithError(effectiveTask);
    const trace = storeTrace(effectiveTask, spans);

    return res.json({ result, traceId: trace.traceId });
  } catch (err) {
    return res.status(500).json({ error: 'Agent execution failed', details: String(err) });
  }
});

// GET /traces/:traceId
app.get('/traces/:traceId', (req, res) => {
  const { traceId } = req.params;
  const trace = traceStore.get(traceId);

  if (!trace) {
    return res.status(404).json({ error: `Trace ${traceId} not found` });
  }

  return res.json(trace);
});

// GET /traces — return summaries of the last 10 traces (newest first)
app.get('/traces', (req, res) => {
  const all = Array.from(traceStore.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map(({ traceId, task, totalDurationMs, createdAt, spans }) => ({
      traceId,
      task,
      totalDurationMs,
      createdAt,
      spanCount: spans.length,
    }));

  return res.json({ traces: all });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = 3018;
app.listen(PORT, () =>
  console.log(`Agent Observability demo server running at http://localhost:${PORT}`),
);
