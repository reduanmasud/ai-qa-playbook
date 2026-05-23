/**
 * Grounding utility helpers for hallucination detection tests.
 *
 * "Grounding" means every claim in an answer can be traced back to the
 * source context. These helpers make it easy to write precise, programmatic
 * checks instead of relying solely on the server-side grounding endpoint.
 */

/**
 * Extract all numeric values from a piece of text.
 * Captures integers, decimals, and percentages (e.g. 42, 3.14, 85%).
 *
 * @param text - The string to scan.
 * @returns An array of numbers parsed from every numeric token found.
 */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:\.\d+)?%?/g) ?? [];
  return matches.map((token) => parseFloat(token.replace('%', '')));
}

/**
 * Verify whether each fact (short string claim) is supported by the context.
 *
 * A fact is considered supported when every significant token in the fact
 * (case-insensitive) appears somewhere in the context. Tokens include whole
 * words as well as hyphenated compounds (e.g. "12-week" is checked as a
 * single token). This is a simple but effective heuristic for detecting
 * extrinsic hallucinations — claims added from outside the source.
 *
 * @param facts   - Array of claim strings to check.
 * @param context - The source document to check against.
 * @returns An object with `supported` and `unsupported` arrays.
 */
export function checkFactsInContext(
  facts: string[],
  context: string
): { supported: string[]; unsupported: string[] } {
  const contextLower = context.toLowerCase();

  const supported: string[] = [];
  const unsupported: string[] = [];

  for (const fact of facts) {
    // Split on whitespace only — keep hyphens so "12-week" stays intact
    const tokens = fact
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const allPresent = tokens.every((t) => contextLower.includes(t));

    if (allPresent) {
      supported.push(fact);
    } else {
      unsupported.push(fact);
    }
  }

  return { supported, unsupported };
}
