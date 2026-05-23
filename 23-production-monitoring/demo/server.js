const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
// Stores the last N suite run results so /eval/history and /eval/compare work
// without a database.

const MAX_HISTORY = 20;

/** @type {Array<SuiteResult>} */
const history = [];

/** @type {SuiteResult | null} */
let baseline = null;

// ---------------------------------------------------------------------------
// Built-in check implementations
// ---------------------------------------------------------------------------
// Each check receives the request context and returns { passed, score, durationMs }.
// In a real pipeline these would call your LLM/API endpoints and measure real
// metrics.  Here they are deterministic so the test suite is reproducible.

/**
 * Latency check — simulates a fast API call (<500 ms).
 */
function runLatencyCheck() {
  const start = Date.now();
  // Simulate a synchronous "call" that takes a few ms
  const simulated = 80 + Math.floor(Math.random() * 60); // 80–139 ms
  const durationMs = Date.now() - start + simulated;
  const passed = durationMs < 500;
  return { passed, score: passed ? 1.0 : 0.0, durationMs };
}

/**
 * Token budget check — simulates token counting.
 * Always passes in this demo (budget threshold 1000 tokens).
 */
function runTokenBudgetCheck() {
  const start = Date.now();
  const simulatedTokens = 400 + Math.floor(Math.random() * 200); // 400–599
  const threshold = 1000;
  const passed = simulatedTokens < threshold;
  const score = Math.max(0, 1 - simulatedTokens / threshold);
  return { passed, score: parseFloat(score.toFixed(4)), durationMs: Date.now() - start + 10 };
}

/**
 * Safety check — simulates content-safety scoring.
 * Always passes in this demo (score always >= 0.8).
 */
function runSafetyCheck() {
  const start = Date.now();
  const score = 0.92 + Math.random() * 0.07; // 0.92–0.99
  const passed = score >= 0.8;
  return { passed, score: parseFloat(score.toFixed(4)), durationMs: Date.now() - start + 15 };
}

/**
 * Quality check — simulates an LLM-as-judge quality scorer.
 * Returns a fixed score of 0.85 (above the 0.75 threshold).
 */
function runQualityCheck() {
  const start = Date.now();
  const score = 0.85;
  const passed = score >= 0.75;
  return { passed, score, durationMs: Date.now() - start + 25 };
}

const CHECK_RUNNERS = {
  latency_check: runLatencyCheck,
  token_budget_check: runTokenBudgetCheck,
  safety_check: runSafetyCheck,
  quality_check: runQualityCheck,
};

// The canonical set of checks every suite always executes
const BUILT_IN_CHECKS = [
  { id: 'latency_check', name: 'Response latency < 500ms', threshold: 500 },
  { id: 'token_budget_check', name: 'Token usage within budget', threshold: 1000 },
  { id: 'safety_check', name: 'Safety score >= 0.8', threshold: 0.8 },
  { id: 'quality_check', name: 'Quality score >= 0.75', threshold: 0.75 },
];

// ---------------------------------------------------------------------------
// Helper: execute all checks and build a full suite result object
// ---------------------------------------------------------------------------

/**
 * @param {string} suiteId
 * @param {string} target
 * @returns {SuiteResult}
 */
function executeSuite(suiteId, target) {
  const results = BUILT_IN_CHECKS.map((check) => {
    const runner = CHECK_RUNNERS[check.id];
    const { passed, score, durationMs } = runner ? runner() : { passed: false, score: 0, durationMs: 0 };
    return {
      checkId: check.id,
      name: check.name,
      passed,
      score,
      durationMs,
    };
  });

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const passRate = total > 0 ? parseFloat((passed / total).toFixed(4)) : 0;
  const avgScore = total > 0
    ? parseFloat((results.reduce((sum, r) => sum + r.score, 0) / total).toFixed(4))
    : 0;

  return {
    suiteId,
    target,
    timestamp: new Date().toISOString(),
    results,
    summary: { total, passed, failed, passRate, avgScore },
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /eval/run-suite
 * Body: { suiteId: string, target: string }
 * Runs all built-in checks, stores the result in history, returns it.
 */
app.post('/eval/run-suite', (req, res) => {
  const { suiteId, target } = req.body || {};

  if (!suiteId || typeof suiteId !== 'string') {
    return res.status(400).json({ error: 'suiteId is required and must be a string' });
  }
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'target is required and must be a string' });
  }

  const result = executeSuite(suiteId, target);

  // Prepend to history (newest first), cap at MAX_HISTORY
  history.unshift(result);
  if (history.length > MAX_HISTORY) {
    history.splice(MAX_HISTORY);
  }

  return res.status(200).json(result);
});

/**
 * GET /eval/history
 * Returns the last 5 suite runs (newest first).
 */
app.get('/eval/history', (req, res) => {
  return res.status(200).json(history.slice(0, 5));
});

/**
 * POST /eval/compare
 * Body: { suiteIdA: string, suiteIdB: string }
 * Compares the two most-recent runs matching suiteIdA and suiteIdB.
 * Returns { regressions, improvements, unchanged } arrays of check IDs.
 */
app.post('/eval/compare', (req, res) => {
  const { suiteIdA, suiteIdB } = req.body || {};

  if (!suiteIdA || !suiteIdB) {
    return res.status(400).json({ error: 'suiteIdA and suiteIdB are required' });
  }

  // Find the most recent run for each suiteId
  const runA = history.find((r) => r.suiteId === suiteIdA);
  const runB = history.find((r) => r.suiteId === suiteIdB);

  if (!runA) {
    return res.status(404).json({ error: `No history found for suiteId: ${suiteIdA}` });
  }
  if (!runB) {
    return res.status(404).json({ error: `No history found for suiteId: ${suiteIdB}` });
  }

  const regressions = [];
  const improvements = [];
  const unchanged = [];

  // Build a map from checkId → result for suiteA
  const mapA = {};
  for (const r of runA.results) {
    mapA[r.checkId] = r;
  }

  for (const checkB of runB.results) {
    const checkA = mapA[checkB.checkId];
    if (!checkA) {
      // New check in B — treat as improvement
      improvements.push(checkB.checkId);
      continue;
    }

    if (checkA.passed && !checkB.passed) {
      regressions.push(checkB.checkId);
    } else if (!checkA.passed && checkB.passed) {
      improvements.push(checkB.checkId);
    } else {
      unchanged.push(checkB.checkId);
    }
  }

  return res.status(200).json({ regressions, improvements, unchanged });
});

/**
 * POST /eval/register-baseline
 * Body: { suiteId: string }
 * Stores the most recent run of suiteId as the current baseline.
 */
app.post('/eval/register-baseline', (req, res) => {
  const { suiteId } = req.body || {};

  if (!suiteId || typeof suiteId !== 'string') {
    return res.status(400).json({ error: 'suiteId is required' });
  }

  const run = history.find((r) => r.suiteId === suiteId);
  if (!run) {
    return res.status(404).json({ error: `No history found for suiteId: ${suiteId}` });
  }

  baseline = run;
  return res.status(200).json({ registered: true, baseline });
});

/**
 * GET /eval/baseline
 * Returns the current baseline suite result, or 404 if none registered.
 */
app.get('/eval/baseline', (req, res) => {
  if (!baseline) {
    return res.status(404).json({ error: 'No baseline registered' });
  }
  return res.status(200).json(baseline);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3023;
app.listen(PORT, () => {
  console.log(`[23-production-monitoring] server listening on http://localhost:${PORT}`);
});

module.exports = app;
