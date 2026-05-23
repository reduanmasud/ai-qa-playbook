import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types mirroring server shapes
// ---------------------------------------------------------------------------

interface Span {
  spanId: string;
  name: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  attributes: Record<string, unknown>;
  status: 'ok' | 'error';
}

interface Trace {
  traceId: string;
  task: string;
  spans: Span[];
  totalDurationMs: number;
  createdAt: number;
}

interface RunResponse {
  result: string;
  traceId: string;
}

interface TraceSummary {
  traceId: string;
  task: string;
  totalDurationMs: number;
  createdAt: number;
  spanCount: number;
}

interface TracesListResponse {
  traces: TraceSummary[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = 'http://localhost:3018';

async function runAgent(task: string): Promise<RunResponse> {
  const res = await fetch(`${BASE}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task }),
  });
  if (!res.ok) throw new Error(`POST /agent/run failed: ${res.status}`);
  return res.json();
}

async function runAgentWithError(task?: string): Promise<RunResponse> {
  const res = await fetch(`${BASE}/agent/run-with-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: task ?? 'error-test' }),
  });
  if (!res.ok) throw new Error(`POST /agent/run-with-error failed: ${res.status}`);
  return res.json();
}

async function getTrace(traceId: string): Promise<Trace> {
  const res = await fetch(`${BASE}/traces/${traceId}`);
  if (!res.ok) throw new Error(`GET /traces/${traceId} failed: ${res.status}`);
  return res.json();
}

async function listTraces(): Promise<TracesListResponse> {
  const res = await fetch(`${BASE}/traces`);
  if (!res.ok) throw new Error(`GET /traces failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Agent Observability — Trace Emission and Assertions', () => {

  // ── Test 1: Trace is emitted ─────────────────────────────────────────────
  test('trace is emitted: run returns a non-empty traceId', async () => {
    const { traceId, result } = await runAgent('Summarise the history of computing');

    expect(traceId).toBeTruthy();
    expect(typeof traceId).toBe('string');
    expect(traceId.length).toBeGreaterThan(0);
    expect(result).toBeTruthy();
  });

  // ── Test 2: Trace has all expected spans ─────────────────────────────────
  test('trace has all expected spans: plan, tool_call, synthesize', async () => {
    const { traceId } = await runAgent('Explain quantum entanglement');
    const trace = await getTrace(traceId);

    expect(trace.spans).toBeDefined();
    expect(Array.isArray(trace.spans)).toBe(true);
    expect(trace.spans.length).toBeGreaterThanOrEqual(3);

    const spanNames = trace.spans.map((s) => s.name);
    expect(spanNames).toContain('agent.plan');
    expect(spanNames).toContain('agent.tool_call');
    expect(spanNames).toContain('agent.synthesize');
  });

  // ── Test 3: Span timing is valid ─────────────────────────────────────────
  test('span timing is valid: startTime < endTime and durationMs > 0', async () => {
    const { traceId } = await runAgent('What is the speed of light?');
    const trace = await getTrace(traceId);

    for (const span of trace.spans) {
      expect(span.startTime).toBeDefined();
      expect(span.endTime).toBeDefined();
      expect(span.durationMs).toBeDefined();

      expect(span.startTime).toBeLessThan(span.endTime);
      expect(span.durationMs).toBeGreaterThan(0);

      // durationMs must match the difference (allow 1ms rounding tolerance)
      const computedDuration = span.endTime - span.startTime;
      expect(Math.abs(span.durationMs - computedDuration)).toBeLessThanOrEqual(1);
    }
  });

  // ── Test 4: Total duration equals sum of span durations ──────────────────
  test('totalDurationMs roughly equals sum of all span durationMs', async () => {
    const { traceId } = await runAgent('List the planets in the solar system');
    const trace = await getTrace(traceId);

    const sumOfSpans = trace.spans.reduce((acc, s) => acc + s.durationMs, 0);

    // The total should equal the sum (sequential spans). Allow a small
    // tolerance (5 ms) for any inter-span scheduling overhead.
    expect(Math.abs(trace.totalDurationMs - sumOfSpans)).toBeLessThanOrEqual(5);
  });

  // ── Test 5: Error span is captured ───────────────────────────────────────
  test('error span is captured when agent fails mid-way', async () => {
    const { traceId } = await runAgentWithError('Fetch unavailable resource');
    const trace = await getTrace(traceId);

    const errorSpans = trace.spans.filter((s) => s.status === 'error');
    expect(errorSpans.length).toBeGreaterThanOrEqual(1);

    const errorSpan = errorSpans[0];
    expect(errorSpan.name).toBe('agent.tool_call');
    expect(errorSpan.attributes).toHaveProperty('error_code');
    expect(errorSpan.attributes).toHaveProperty('error_message');
  });

  // ── Test 6: Trace attributes are populated ───────────────────────────────
  test('each span has non-empty attributes and root span carries task', async () => {
    const taskText = 'Describe the water cycle';
    const { traceId } = await runAgent(taskText);
    const trace = await getTrace(traceId);

    for (const span of trace.spans) {
      expect(span.attributes).toBeDefined();
      expect(typeof span.attributes).toBe('object');
      // Every span must carry at least one attribute
      expect(Object.keys(span.attributes).length).toBeGreaterThan(0);
    }

    // The root planning span must carry the original task
    const planSpan = trace.spans.find((s) => s.name === 'agent.plan');
    expect(planSpan).toBeDefined();
    expect(planSpan!.attributes['task']).toBe(taskText);
  });

  // ── Test 7: Traces list endpoint works ───────────────────────────────────
  test('GET /traces returns at least 2 entries after 2 runs', async () => {
    await runAgent('First task for list test');
    await runAgent('Second task for list test');

    const { traces } = await listTraces();

    expect(Array.isArray(traces)).toBe(true);
    expect(traces.length).toBeGreaterThanOrEqual(2);

    // Each summary must include required fields
    for (const summary of traces) {
      expect(summary.traceId).toBeTruthy();
      expect(summary.task).toBeTruthy();
      expect(typeof summary.totalDurationMs).toBe('number');
      expect(typeof summary.spanCount).toBe('number');
      expect(summary.spanCount).toBeGreaterThan(0);
    }
  });

  // ── Test 8: No PII in traces ─────────────────────────────────────────────
  test('no PII (emails or credit-card-like patterns) in any span attributes', async () => {
    const { traceId } = await runAgent('Retrieve user account details');
    const trace = await getTrace(traceId);

    // Regex patterns for common PII forms
    const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
    // Luhn-like 13–16 digit sequences (card numbers)
    const creditCardPattern = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{0,4}\b/;

    for (const span of trace.spans) {
      for (const [key, value] of Object.entries(span.attributes)) {
        const strValue = String(value);

        expect(
          emailPattern.test(strValue),
          `Span "${span.name}" attribute "${key}" contains an email-like string: "${strValue}"`,
        ).toBe(false);

        expect(
          creditCardPattern.test(strValue),
          `Span "${span.name}" attribute "${key}" contains a credit-card-like pattern: "${strValue}"`,
        ).toBe(false);
      }
    }
  });

});
