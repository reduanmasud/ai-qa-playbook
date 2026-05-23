// ---------------------------------------------------------------------------
// Consistency utilities for behavioral AI testing
// ---------------------------------------------------------------------------
// These helpers implement the statistical and semantic checks needed to
// assert that an AI system behaves consistently across rephrasings and runs.
// ---------------------------------------------------------------------------

/**
 * Compute what percentage of answers are identical to the most common answer.
 *
 * The "consistency rate" for a set of answers is defined as the fraction of
 * answers that match the modal (most frequent) value.  A consistency rate of
 * 1.0 means every call returned the same string; 0.5 means half did.
 *
 * Example:
 *   computeConsistencyRate(["4", "4", "4", "5", "4"]) → 0.8
 *
 * @param answers - Array of answer strings from repeated calls
 * @returns A number in [0, 1] representing the consistency rate
 */
export function computeConsistencyRate(answers: string[]): number {
  if (answers.length === 0) return 0;
  if (answers.length === 1) return 1;

  // Count occurrences of each answer
  const counts = new Map<string, number>();
  for (const answer of answers) {
    counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }

  // Find the highest frequency
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) maxCount = count;
  }

  return maxCount / answers.length;
}

/**
 * Detect a logical contradiction between two yes/no answers.
 *
 * A contradiction occurs when one answer is clearly affirmative ("yes", "true",
 * "correct", etc.) and the other is clearly negative ("no", "false", "incorrect",
 * etc.) for questions that are logically opposite.
 *
 * This is intentionally conservative: if neither answer is clearly
 * affirmative/negative, we do NOT flag a contradiction.
 *
 * Example:
 *   detectContradiction("Yes, Paris is the capital.", "Yes, Berlin is the capital of France.")
 *   → true  (both affirm mutually exclusive claims)
 *
 *   detectContradiction("Yes, that is correct.", "No, that is not correct.")
 *   → false  (one says yes, one says no — this is consistent, not contradictory)
 *
 * @param answerA - Answer to the first question
 * @param answerB - Answer to the second (opposite-framed) question
 * @returns true if both answers make conflicting affirmative claims
 */
export function detectContradiction(answerA: string, answerB: string): boolean {
  const positivePatterns = [/\byes\b/i, /\btrue\b/i, /\bcorrect\b/i, /\bthat's right\b/i, /\bindeed\b/i];
  const negativePatterns = [/\bno\b/i, /\bfalse\b/i, /\bincorrect\b/i, /\bnot\b/i, /\bnever\b/i];

  const isPositive = (text: string): boolean =>
    positivePatterns.some((re) => re.test(text));

  const isNegative = (text: string): boolean =>
    negativePatterns.some((re) => re.test(text));

  const aPositive = isPositive(answerA);
  const aNegative = isNegative(answerA);
  const bPositive = isPositive(answerB);
  const bNegative = isNegative(answerB);

  // A contradiction occurs when both questions get affirmative answers but the
  // questions themselves are logically opposite — meaning both "yes" answers
  // cannot both be true.  We leave it to the test author to pair questions
  // appropriately; this function simply reports when both answers are affirmative.
  if (aPositive && !aNegative && bPositive && !bNegative) {
    return true;
  }

  return false;
}

/**
 * Check whether an answer contains a given substring, case-insensitively.
 * Useful for semantic equivalence checks (e.g., "does the answer mention '4'?").
 *
 * @param answer - The answer string to inspect
 * @param expected - The substring to look for
 * @returns true if answer contains expected (case-insensitive)
 */
export function semanticContains(answer: string, expected: string): boolean {
  return answer.toLowerCase().includes(expected.toLowerCase());
}

/**
 * Compute the pass@k consistency metric.
 *
 * Pass@k asks: "out of k attempts, does at least (k - 1) produce the same label?"
 * This is a lenient reliability threshold: one outlier is tolerated.
 *
 * Returns an object with:
 *   - passed: boolean — whether the threshold was met
 *   - rate:   number  — actual consistency rate (0–1)
 *   - modal:  string  — the most common value
 *
 * @param values    - Array of k values (labels, answers, etc.)
 * @param threshold - Minimum consistency rate required (default 0.8 = 80%)
 */
export function passAtK(
  values: string[],
  threshold = 0.8
): { passed: boolean; rate: number; modal: string } {
  if (values.length === 0) {
    return { passed: false, rate: 0, modal: '' };
  }

  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  let maxCount = 0;
  let modal = '';
  for (const [value, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      modal = value;
    }
  }

  const rate = maxCount / values.length;
  return { passed: rate >= threshold, rate, modal };
}
