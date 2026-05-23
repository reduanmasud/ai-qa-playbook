export interface TrajectoryStep {
  step: number;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

/**
 * Find the first step in a trajectory that used the given tool.
 */
export function findToolCall(
  trajectory: TrajectoryStep[],
  toolName: string
): TrajectoryStep | undefined {
  return trajectory.find((step) => step.tool === toolName);
}

/**
 * Compute Tool Call Accuracy (TCA) as a percentage.
 *
 * @param results - Array of { expectedTool, actualTool } pairs.
 * @returns A number between 0 and 100 representing the percentage of correct
 *          tool selections. Returns 0 when the array is empty.
 */
export function computeToolCallAccuracy(
  results: Array<{ expectedTool: string; actualTool: string }>
): number {
  if (results.length === 0) return 0;

  const correct = results.filter((r) => r.expectedTool === r.actualTool).length;
  return Math.round((correct / results.length) * 100);
}
