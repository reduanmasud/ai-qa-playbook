import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface GoldenCase {
  id: string;
  input: string;
  expectedLabel: string;
  minConfidence: number;
}

interface ClassifyResponse {
  label: string;
  confidence: number;
}

interface CaseResult {
  id: string;
  input: string;
  expectedLabel: string;
  actualLabel: string;
  expectedMinConfidence: number;
  actualConfidence: number;
  labelMatch: boolean;
  confidenceMet: boolean;
  passed: boolean;
}

function loadGoldenDataset(): GoldenCase[] {
  const fixturePath = path.join(__dirname, 'fixtures', 'golden.json');
  const raw = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(raw) as GoldenCase[];
}

const BASE_URL = 'http://localhost:3012';
const PASS_RATE_THRESHOLD = 0.8;

// Individual golden case tests — one per entry in the dataset
const goldenCases = loadGoldenDataset();

for (const goldenCase of goldenCases) {
  test(`[${goldenCase.id}] classifies "${goldenCase.input}" as ${goldenCase.expectedLabel}`, async ({ request }) => {
    const response = await request.post(`${BASE_URL}/classify`, {
      data: { text: goldenCase.input },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json() as ClassifyResponse;

    expect(
      body.label,
      `Expected label "${goldenCase.expectedLabel}" but got "${body.label}" for input: "${goldenCase.input}"`
    ).toBe(goldenCase.expectedLabel);

    expect(
      body.confidence,
      `Expected confidence >= ${goldenCase.minConfidence} but got ${body.confidence} for input: "${goldenCase.input}"`
    ).toBeGreaterThanOrEqual(goldenCase.minConfidence);
  });
}

// Pass-rate gate: fewer than 80% passing fails the suite with a detailed report
test('pass rate meets 80% threshold across all golden cases', async ({ request }) => {
  const dataset = loadGoldenDataset();
  const results: CaseResult[] = [];

  for (const goldenCase of dataset) {
    const response = await request.post(`${BASE_URL}/classify`, {
      data: { text: goldenCase.input },
    });

    const body = await response.json() as ClassifyResponse;
    const labelMatch = body.label === goldenCase.expectedLabel;
    const confidenceMet = body.confidence >= goldenCase.minConfidence;
    const passed = labelMatch && confidenceMet;

    results.push({
      id: goldenCase.id,
      input: goldenCase.input,
      expectedLabel: goldenCase.expectedLabel,
      actualLabel: body.label,
      expectedMinConfidence: goldenCase.minConfidence,
      actualConfidence: body.confidence,
      labelMatch,
      confidenceMet,
      passed,
    });
  }

  const passCount = results.filter(r => r.passed).length;
  const passRate = passCount / results.length;

  const failedCases = results.filter(r => !r.passed);
  const reportLines: string[] = [
    `\nGolden Dataset Pass Rate: ${passCount}/${results.length} (${(passRate * 100).toFixed(1)}%)`,
    `Threshold: ${(PASS_RATE_THRESHOLD * 100).toFixed(0)}%`,
    '',
  ];

  if (failedCases.length > 0) {
    reportLines.push('Failed cases:');
    for (const fc of failedCases) {
      const labelNote = fc.labelMatch ? '' : ` | label: expected="${fc.expectedLabel}" got="${fc.actualLabel}"`;
      const confNote = fc.confidenceMet ? '' : ` | confidence: expected>=${fc.expectedMinConfidence} got=${fc.actualConfidence}`;
      reportLines.push(`  [${fc.id}] "${fc.input}"${labelNote}${confNote}`);
    }
  }

  const report = reportLines.join('\n');

  expect(
    passRate,
    `Pass rate ${(passRate * 100).toFixed(1)}% is below the required ${(PASS_RATE_THRESHOLD * 100).toFixed(0)}% threshold.${report}`
  ).toBeGreaterThanOrEqual(PASS_RATE_THRESHOLD);
});

// Regression detection: runs all cases and logs a formatted table showing pass/fail per case
test('regression detection — full golden set table report', async ({ request }) => {
  const dataset = loadGoldenDataset();
  const results: CaseResult[] = [];

  for (const goldenCase of dataset) {
    const response = await request.post(`${BASE_URL}/classify`, {
      data: { text: goldenCase.input },
    });

    const body = await response.json() as ClassifyResponse;
    const labelMatch = body.label === goldenCase.expectedLabel;
    const confidenceMet = body.confidence >= goldenCase.minConfidence;
    const passed = labelMatch && confidenceMet;

    results.push({
      id: goldenCase.id,
      input: goldenCase.input,
      expectedLabel: goldenCase.expectedLabel,
      actualLabel: body.label,
      expectedMinConfidence: goldenCase.minConfidence,
      actualConfidence: body.confidence,
      labelMatch,
      confidenceMet,
      passed,
    });
  }

  // Build a table for the console
  const colWidths = { id: 6, input: 32, expected: 10, actual: 10, conf: 10, status: 6 };
  const pad = (s: string, n: number) => s.substring(0, n).padEnd(n);
  const header = [
    pad('ID', colWidths.id),
    pad('Input', colWidths.input),
    pad('Expected', colWidths.expected),
    pad('Actual', colWidths.actual),
    pad('Conf', colWidths.conf),
    pad('Pass?', colWidths.status),
  ].join(' | ');

  const separator = '-'.repeat(header.length);
  const rows = results.map(r => [
    pad(r.id, colWidths.id),
    pad(r.input, colWidths.input),
    pad(r.expectedLabel, colWidths.expected),
    pad(r.actualLabel, colWidths.actual),
    pad(r.actualConfidence.toFixed(2), colWidths.conf),
    pad(r.passed ? 'PASS' : 'FAIL', colWidths.status),
  ].join(' | '));

  const passCount = results.filter(r => r.passed).length;
  const table = [
    '',
    '=== Golden Dataset Regression Report ===',
    separator,
    header,
    separator,
    ...rows,
    separator,
    `Total: ${passCount}/${results.length} passed (${((passCount / results.length) * 100).toFixed(1)}%)`,
    '',
  ].join('\n');

  console.log(table);

  // This test always passes as long as the server responds — its purpose is to surface the report.
  // Regression failures are caught by individual case tests and the pass-rate gate above.
  expect(results.length).toBe(dataset.length);
});
