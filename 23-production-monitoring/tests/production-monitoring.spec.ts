import { test, expect, request } from '@playwright/test';
import evalSuite from './fixtures/eval-suite.json';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3023';

/** Convenience wrapper — POST JSON to the eval server */
async function postJSON(url: string, body: unknown) {
  const ctx = await request.newContext();
  const res = await ctx.post(url, { data: body });
  return res;
}

/** Convenience wrapper — GET from the eval server */
async function getJSON(url: string) {
  const ctx = await request.newContext();
  const res = await ctx.get(url);
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Tutorial 23 — Production Monitoring & CI Eval Pipelines', () => {

  // -------------------------------------------------------------------------
  // 1. Eval suite runs and returns a well-formed summary
  // -------------------------------------------------------------------------
  test('eval suite runs and returns summary', async () => {
    const res = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: evalSuite.suiteId,
      target: 'https://api.example.com',
    });

    expect(res.status()).toBe(200);

    const body = await res.json();

    // Top-level shape
    expect(body).toHaveProperty('suiteId');
    expect(body).toHaveProperty('target');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('results');
    expect(body).toHaveProperty('summary');

    // Summary fields
    const { summary } = body;
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('passed');
    expect(summary).toHaveProperty('failed');
    expect(summary).toHaveProperty('passRate');
    expect(summary).toHaveProperty('avgScore');

    // Sanity: no negative counts
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.passed).toBeGreaterThanOrEqual(0);
    expect(summary.failed).toBeGreaterThanOrEqual(0);
    expect(summary.passRate).toBeGreaterThanOrEqual(0);
    expect(summary.passRate).toBeLessThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // 2. All four built-in checks are executed and present in results
  // -------------------------------------------------------------------------
  test('all checks execute', async () => {
    const res = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: evalSuite.suiteId,
      target: 'https://api.example.com',
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    const results: Array<{ checkId: string; name: string; passed: boolean; score: number; durationMs: number }> = body.results;

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(4);

    const checkIds = results.map((r) => r.checkId);
    expect(checkIds).toContain('latency_check');
    expect(checkIds).toContain('token_budget_check');
    expect(checkIds).toContain('safety_check');
    expect(checkIds).toContain('quality_check');

    // Each result must have the required fields
    for (const result of results) {
      expect(result).toHaveProperty('checkId');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('durationMs');
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.score).toBe('number');
      expect(typeof result.durationMs).toBe('number');
    }
  });

  // -------------------------------------------------------------------------
  // 3. Pass-rate calculation is arithmetically correct
  // -------------------------------------------------------------------------
  test('pass rate calculation is correct', async () => {
    const res = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: evalSuite.suiteId,
      target: 'https://api.example.com',
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    const { results, summary } = body;

    const expectedPassed = results.filter((r: { passed: boolean }) => r.passed).length;
    const expectedTotal = results.length;
    const expectedPassRate = parseFloat((expectedPassed / expectedTotal).toFixed(4));

    expect(summary.passed).toBe(expectedPassed);
    expect(summary.total).toBe(expectedTotal);
    expect(summary.failed).toBe(expectedTotal - expectedPassed);
    expect(summary.passRate).toBeCloseTo(expectedPassRate, 3);
  });

  // -------------------------------------------------------------------------
  // 4. History accumulates across multiple runs
  // -------------------------------------------------------------------------
  test('history accumulates across runs', async () => {
    // Run the suite three times with a distinct ID so we can count easily
    const histSuiteId = `history-test-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      const res = await postJSON(`${BASE_URL}/eval/run-suite`, {
        suiteId: histSuiteId,
        target: 'https://api.example.com',
      });
      expect(res.status()).toBe(200);
    }

    const histRes = await getJSON(`${BASE_URL}/eval/history`);
    expect(histRes.status()).toBe(200);

    const histBody: Array<{ suiteId: string }> = await histRes.json();
    expect(Array.isArray(histBody)).toBe(true);

    // The three runs we just created must appear in history
    const matchingRuns = histBody.filter((r) => r.suiteId === histSuiteId);
    expect(matchingRuns.length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // 5. Baseline registration and retrieval
  // -------------------------------------------------------------------------
  test('baseline registration stores and retrieves the suite result', async () => {
    const baselineSuiteId = `baseline-test-${Date.now()}`;

    // First run a suite to create a history entry
    const runRes = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: baselineSuiteId,
      target: 'https://api.example.com',
    });
    expect(runRes.status()).toBe(200);

    // Register it as baseline
    const regRes = await postJSON(`${BASE_URL}/eval/register-baseline`, {
      suiteId: baselineSuiteId,
    });
    expect(regRes.status()).toBe(200);

    const regBody = await regRes.json();
    expect(regBody.registered).toBe(true);
    expect(regBody).toHaveProperty('baseline');
    expect(regBody.baseline.suiteId).toBe(baselineSuiteId);

    // Fetch baseline via GET
    const fetchRes = await getJSON(`${BASE_URL}/eval/baseline`);
    expect(fetchRes.status()).toBe(200);

    const fetchBody = await fetchRes.json();
    expect(fetchBody.suiteId).toBe(baselineSuiteId);
    expect(fetchBody).toHaveProperty('summary');
    expect(fetchBody).toHaveProperty('results');
  });

  // -------------------------------------------------------------------------
  // 6. Regression detection returns the correct comparison shape
  // -------------------------------------------------------------------------
  test('regression detection returns regressions, improvements, and unchanged arrays', async () => {
    const suiteA = `compare-a-${Date.now()}`;
    const suiteB = `compare-b-${Date.now()}`;

    // Create history entries for both suites
    const resA = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: suiteA,
      target: 'https://api.example.com',
    });
    expect(resA.status()).toBe(200);

    const resB = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: suiteB,
      target: 'https://api.example.com',
    });
    expect(resB.status()).toBe(200);

    // Compare A vs B
    const cmpRes = await postJSON(`${BASE_URL}/eval/compare`, {
      suiteIdA: suiteA,
      suiteIdB: suiteB,
    });
    expect(cmpRes.status()).toBe(200);

    const cmpBody = await cmpRes.json();
    expect(cmpBody).toHaveProperty('regressions');
    expect(cmpBody).toHaveProperty('improvements');
    expect(cmpBody).toHaveProperty('unchanged');

    expect(Array.isArray(cmpBody.regressions)).toBe(true);
    expect(Array.isArray(cmpBody.improvements)).toBe(true);
    expect(Array.isArray(cmpBody.unchanged)).toBe(true);

    // The union of all three arrays should equal the number of checks
    const totalCheckCount =
      cmpBody.regressions.length + cmpBody.improvements.length + cmpBody.unchanged.length;
    expect(totalCheckCount).toBe(4); // 4 built-in checks
  });

  // -------------------------------------------------------------------------
  // 7. CI gate behavior — passRate must be computable and usable as a gate
  // -------------------------------------------------------------------------
  test('CI gate: passRate can be used as a binary quality gate', async () => {
    const gateRes = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: `ci-gate-${Date.now()}`,
      target: 'https://api.example.com',
    });
    expect(gateRes.status()).toBe(200);

    const body = await gateRes.json();
    const { passRate } = body.summary;

    // The gate threshold (must pass 80% of checks to proceed)
    const GATE_THRESHOLD = 0.8;

    // The demo server always returns all-passing checks, so this suite should
    // clear the gate.  If the gate logic is broken this assertion will fail,
    // proving the CI gate would fire correctly in production.
    expect(typeof passRate).toBe('number');
    expect(passRate).toBeGreaterThanOrEqual(0);
    expect(passRate).toBeLessThanOrEqual(1);

    // Demonstrate gate logic (in real CI, passRate < GATE_THRESHOLD would exit(1))
    const gateWouldPass = passRate >= GATE_THRESHOLD;
    expect(gateWouldPass).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. Timestamp must be a valid ISO 8601 string
  // -------------------------------------------------------------------------
  test('timestamp format is valid ISO 8601', async () => {
    const res = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: `timestamp-test-${Date.now()}`,
      target: 'https://api.example.com',
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    const { timestamp } = body;

    expect(typeof timestamp).toBe('string');

    // ISO 8601 dates parse to valid Date objects (not NaN)
    const parsed = new Date(timestamp);
    expect(isNaN(parsed.getTime())).toBe(false);

    // Must contain the 'T' separator that distinguishes ISO 8601 from other formats
    expect(timestamp).toContain('T');

    // Must contain timezone info (Z for UTC or +/-offset)
    expect(timestamp.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timestamp)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9. Suite ID in results matches the requested suiteId
  // -------------------------------------------------------------------------
  test('suite ID in results matches the requested suiteId', async () => {
    const requestedId = `suite-id-echo-${Date.now()}`;

    const res = await postJSON(`${BASE_URL}/eval/run-suite`, {
      suiteId: requestedId,
      target: 'https://api.example.com',
    });
    expect(res.status()).toBe(200);

    const body = await res.json();

    // The top-level suiteId must echo back the requested ID
    expect(body.suiteId).toBe(requestedId);

    // History entry should also reflect the same suiteId
    const histRes = await getJSON(`${BASE_URL}/eval/history`);
    expect(histRes.status()).toBe(200);

    const histBody: Array<{ suiteId: string }> = await histRes.json();
    const match = histBody.find((r) => r.suiteId === requestedId);
    expect(match).toBeDefined();
    expect(match?.suiteId).toBe(requestedId);
  });

});
