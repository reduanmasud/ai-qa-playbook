import { APIRequestContext, expect } from '@playwright/test';

export interface Turn {
  message: string;
  /**
   * If provided, the response text must contain this substring (case-insensitive).
   */
  expectedInResponse?: string;
}

export interface ConversationResult {
  turns: Array<{
    message: string;
    response: string;
    turnCount: number;
  }>;
  finalTurnCount: number;
}

/**
 * Runs a multi-turn conversation against the /chat endpoint and asserts
 * that each turn's response contains the expected substring (if provided).
 *
 * @param request   - Playwright APIRequestContext
 * @param sessionId - Unique session identifier for this conversation
 * @param turns     - Ordered list of messages and optional response assertions
 * @returns         - Full conversation result including all responses
 */
export async function runConversation(
  request: APIRequestContext,
  sessionId: string,
  turns: Turn[]
): Promise<ConversationResult> {
  const results: ConversationResult['turns'] = [];

  for (const turn of turns) {
    const response = await request.post('/chat', {
      data: { sessionId, message: turn.message },
    });

    expect(response.ok(), `POST /chat failed for message: "${turn.message}"`).toBe(true);

    const body = await response.json() as { response: string; turnCount: number };

    if (turn.expectedInResponse !== undefined) {
      expect(
        body.response.toLowerCase(),
        `Turn "${turn.message}" — expected response to contain "${turn.expectedInResponse}"`
      ).toContain(turn.expectedInResponse.toLowerCase());
    }

    results.push({
      message: turn.message,
      response: body.response,
      turnCount: body.turnCount,
    });
  }

  const finalTurnCount = results.length > 0 ? results[results.length - 1].turnCount : 0;

  return { turns: results, finalTurnCount };
}

/**
 * Generates a unique session ID for test isolation.
 * Combines a base name with a timestamp and random suffix so parallel
 * test runs never share a session accidentally.
 */
export function uniqueSessionId(base: string = 'session'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 7);
  return `${base}-${timestamp}-${random}`;
}
