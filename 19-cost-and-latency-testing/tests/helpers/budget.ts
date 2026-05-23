// ---------------------------------------------------------------------------
// Budget and latency utilities for AI cost testing
// ---------------------------------------------------------------------------
// These helpers implement token estimation, cost calculation, and SLA checks
// that are useful when asserting AI API usage stays within expected bounds.
// ---------------------------------------------------------------------------

/**
 * Estimate the number of tokens in a text string.
 *
 * Uses the same approximation as the demo server: word count × 1.3, truncated
 * to an integer.  Real LLM tokenisers (BPE / SentencePiece) produce ~1.3
 * tokens per English word on average, so this is a realistic mock formula.
 *
 * Example:
 *   estimateTokens("Hello world how are you") → 6   (5 words × 1.3 = 6.5 → 6)
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (non-negative integer)
 */
export function estimateTokens(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  const words = text.split(/\s+/).filter(Boolean);
  return (words.length * 1.3) | 0;
}

/**
 * Calculate the USD cost for a given token count at a specified per-token rate.
 *
 * Example (at the demo server's mock rate of $0.000002/token):
 *   calculateCost(500, 0.000002) → 0.001  ($0.001 for 500 tokens)
 *
 * @param tokens      - Number of tokens consumed
 * @param ratePerToken - Cost in USD per single token
 * @returns Total cost in USD (non-negative float)
 */
export function calculateCost(tokens: number, ratePerToken: number): number {
  if (tokens < 0 || ratePerToken < 0) return 0;
  return tokens * ratePerToken;
}

/**
 * Check whether a measured latency is within a given SLA threshold.
 *
 * Returns true when the observed latency is strictly less than the SLA
 * limit.  Equality is considered a breach (a request that lands exactly on
 * the SLA boundary is not "within" budget).
 *
 * Example:
 *   isWithinSLA(450, 500) → true   // 450ms < 500ms SLA
 *   isWithinSLA(500, 500) → false  // exactly at the limit → not within
 *   isWithinSLA(600, 500) → false  // over the limit
 *
 * @param latencyMs - Observed response latency in milliseconds
 * @param slaMs     - SLA ceiling in milliseconds
 * @returns true if latencyMs is strictly less than slaMs
 */
export function isWithinSLA(latencyMs: number, slaMs: number): boolean {
  return latencyMs < slaMs;
}
