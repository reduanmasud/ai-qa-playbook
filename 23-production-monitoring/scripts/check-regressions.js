#!/usr/bin/env node
/**
 * check-regressions.js
 *
 * CI gate script — reads the Playwright JSON results file and exits with a
 * non-zero code when the overall eval pass rate falls below the threshold.
 *
 * Usage (called by GitHub Actions after `npm run test:23`):
 *   node 23-production-monitoring/scripts/check-regressions.js
 *
 * The script looks for the results file at the paths Playwright produces by
 * default.  You can override via environment variables:
 *   RESULTS_FILE   – path to the playwright JSON results file
 *   PASS_THRESHOLD – minimum acceptable pass rate (default: 0.8)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PASS_THRESHOLD = parseFloat(process.env.PASS_THRESHOLD || '0.8');

// Playwright writes a JSON results summary when you configure the "json"
// reporter.  The default output path is `test-results/results.json`.
// We search a few common locations in order.
const CANDIDATE_PATHS = [
  process.env.RESULTS_FILE,
  path.join(process.cwd(), 'test-results', 'results.json'),
  path.join(process.cwd(), '23-production-monitoring', 'test-results', 'results.json'),
  path.join(__dirname, '..', 'test-results', 'results.json'),
].filter(Boolean);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the first candidate path that exists on disk.
 * @returns {string | null}
 */
function findResultsFile() {
  for (const candidate of CANDIDATE_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Count passed / total test cases from a Playwright JSON results object.
 * The schema is:  { suites: [{ specs: [{ tests: [{ results: [{ status }] }] }] }] }
 *
 * @param {object} report - Parsed Playwright JSON report
 * @returns {{ total: number, passed: number, failed: number, passRate: number }}
 */
function countResults(report) {
  let total = 0;
  let passed = 0;

  /**
   * Recursively walk suites (Playwright nests them).
   * @param {object[]} suites
   */
  function walkSuites(suites) {
    if (!Array.isArray(suites)) return;
    for (const suite of suites) {
      if (Array.isArray(suite.specs)) {
        for (const spec of suite.specs) {
          if (Array.isArray(spec.tests)) {
            for (const test of spec.tests) {
              if (Array.isArray(test.results)) {
                // Take the last result (retry-aware)
                const last = test.results[test.results.length - 1];
                if (last) {
                  total += 1;
                  if (last.status === 'passed') {
                    passed += 1;
                  }
                }
              }
            }
          }
        }
      }
      // Recurse into nested suites
      if (Array.isArray(suite.suites)) {
        walkSuites(suite.suites);
      }
    }
  }

  walkSuites(report.suites || []);

  const failed = total - passed;
  const passRate = total > 0 ? passed / total : 0;
  return { total, passed, failed, passRate };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('=== AI Eval Regression Gate ===');
  console.log(`Pass-rate threshold: ${(PASS_THRESHOLD * 100).toFixed(0)}%`);

  const resultsFile = findResultsFile();

  if (!resultsFile) {
    // If no results file exists yet (e.g. first run in CI), emit a warning
    // but do not fail — the Playwright run itself is the gate for missing tests.
    console.warn('WARN: No Playwright results file found.  Skipping regression gate.');
    console.warn('      Expected locations:');
    CANDIDATE_PATHS.forEach((p) => console.warn(`        ${p}`));
    process.exit(0);
  }

  console.log(`Reading results from: ${resultsFile}`);

  let report;
  try {
    const raw = fs.readFileSync(resultsFile, 'utf8');
    report = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: Failed to parse results file: ${err.message}`);
    process.exit(1);
  }

  const { total, passed, failed, passRate } = countResults(report);

  console.log(`Results:  ${passed}/${total} passed  (${failed} failed)`);
  console.log(`Pass rate: ${(passRate * 100).toFixed(1)}%`);

  if (total === 0) {
    console.warn('WARN: No test results found in the report.  Check Playwright configuration.');
    process.exit(0);
  }

  if (passRate < PASS_THRESHOLD) {
    console.error(
      `FAIL: Pass rate ${(passRate * 100).toFixed(1)}% is below threshold ` +
        `${(PASS_THRESHOLD * 100).toFixed(0)}%.  Blocking CI.`
    );
    process.exit(1);
  }

  console.log(`PASS: Pass rate ${(passRate * 100).toFixed(1)}% meets the ${(PASS_THRESHOLD * 100).toFixed(0)}% threshold.`);
  process.exit(0);
}

main();
