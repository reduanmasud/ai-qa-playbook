import { test, expect } from '@playwright/test';
import { runConversation, uniqueSessionId } from './helpers/conversation';

// ---------------------------------------------------------------------------
// Test 1: Context Retention
// Verify that information shared in turn 1 is recalled in turn 3, even
// after an unrelated message in turn 2.
// ---------------------------------------------------------------------------
test('context retention — name stated in turn 1 recalled in turn 3', async ({ request }) => {
  const sessionId = uniqueSessionId('context-retention');

  const result = await runConversation(request, sessionId, [
    {
      message: 'My name is Alice',
      expectedInResponse: 'Alice',
    },
    {
      message: 'What is the weather like today?',
      // No assertion on turn 2 — it is a topic switch
    },
    {
      message: 'What is my name?',
      expectedInResponse: 'Alice',
    },
  ]);

  // The conversation had exactly 3 turns
  expect(result.finalTurnCount).toBe(3);
});

// ---------------------------------------------------------------------------
// Test 2: Session Isolation
// Two concurrent sessions must not bleed state into each other.
// User A's name must not appear in session B.
// ---------------------------------------------------------------------------
test('session isolation — two sessions do not share state', async ({ request }) => {
  const sessionA = uniqueSessionId('isolation-a');
  const sessionB = uniqueSessionId('isolation-b');

  // Session A: introduce a name
  await request.post('/chat', {
    data: { sessionId: sessionA, message: 'My name is Charlie' },
  });

  // Session B: ask for name — should not know it
  const responseBRaw = await request.post('/chat', {
    data: { sessionId: sessionB, message: 'What is my name?' },
  });
  const responseB = await responseBRaw.json() as { response: string; turnCount: number };

  expect(responseB.response.toLowerCase()).not.toContain('charlie');
  expect(responseB.response.toLowerCase()).toContain("don't know your name");

  // Session A: confirm it still knows the name
  const responseARaw = await request.post('/chat', {
    data: { sessionId: sessionA, message: 'What is my name?' },
  });
  const responseA = await responseARaw.json() as { response: string; turnCount: number };

  expect(responseA.response.toLowerCase()).toContain('charlie');
});

// ---------------------------------------------------------------------------
// Test 3: Turn Count Tracking
// After exactly 5 messages the turnCount must equal 5.
// ---------------------------------------------------------------------------
test('turn count tracking — 5 messages yields turnCount of 5', async ({ request }) => {
  const sessionId = uniqueSessionId('turn-count');

  const messages = [
    'Hello',
    'My name is Dana',
    'What is the weather?',
    'I like cats',
    'What is my name?',
  ];

  let lastTurnCount = 0;
  for (const [index, message] of messages.entries()) {
    const raw = await request.post('/chat', {
      data: { sessionId, message },
    });
    expect(raw.ok()).toBe(true);
    const body = await raw.json() as { response: string; turnCount: number };
    lastTurnCount = body.turnCount;
    expect(body.turnCount).toBe(index + 1);
  }

  expect(lastTurnCount).toBe(5);

  // Cross-check with GET /session/:sessionId
  const metaRaw = await request.get(`/session/${sessionId}`);
  const meta = await metaRaw.json() as { turnCount: number; hasName: boolean };
  expect(meta.turnCount).toBe(5);
  expect(meta.hasName).toBe(true);
});

// ---------------------------------------------------------------------------
// Test 4: Session Reset
// After the user says "start over", previously stored information must be gone.
// ---------------------------------------------------------------------------
test('session reset — information is forgotten after start over', async ({ request }) => {
  const sessionId = uniqueSessionId('reset');

  // Introduce name
  await request.post('/chat', {
    data: { sessionId, message: 'My name is Eve' },
  });

  // Confirm it was stored
  const beforeReset = await request.post('/chat', {
    data: { sessionId, message: 'What is my name?' },
  });
  const beforeBody = await beforeReset.json() as { response: string; turnCount: number };
  expect(beforeBody.response.toLowerCase()).toContain('eve');

  // Reset
  const resetRaw = await request.post('/chat', {
    data: { sessionId, message: 'start over' },
  });
  const resetBody = await resetRaw.json() as { response: string; turnCount: number };
  expect(resetBody.response.toLowerCase()).toContain('forgotten');
  // turnCount resets to 0 after a reset
  expect(resetBody.turnCount).toBe(0);

  // Ask for name again — should no longer know it
  const afterReset = await request.post('/chat', {
    data: { sessionId, message: 'What is my name?' },
  });
  const afterBody = await afterReset.json() as { response: string; turnCount: number };
  expect(afterBody.response.toLowerCase()).not.toContain('eve');
  expect(afterBody.response.toLowerCase()).toContain("don't know your name");
});

// ---------------------------------------------------------------------------
// Test 5: Context Window Simulation
// Send 10 messages and verify that context from turn 1 is still accessible
// in turn 10.  This simulates a scenario where a real LLM would need to
// maintain a sufficiently large context window.
// ---------------------------------------------------------------------------
test('context window simulation — turn-1 context accessible in turn 10', async ({ request }) => {
  const sessionId = uniqueSessionId('context-window');

  // Turn 1: introduce name
  await request.post('/chat', {
    data: { sessionId, message: 'My name is Frank' },
  });

  // Turns 2–9: unrelated filler messages
  const fillers = [
    'Tell me about the weather.',
    'I enjoy hiking on weekends.',
    'What time is it?',
    'Do you like music?',
    'What is your favorite color?',
    'I had pizza for lunch.',
    'Can you help me with math: 6 * 7',
    'How many messages have we sent?',
  ];
  for (const msg of fillers) {
    await request.post('/chat', {
      data: { sessionId, message: msg },
    });
  }

  // Turn 10: ask for name — should still recall "Frank"
  const turn10Raw = await request.post('/chat', {
    data: { sessionId, message: 'What is my name?' },
  });
  expect(turn10Raw.ok()).toBe(true);
  const turn10Body = await turn10Raw.json() as { response: string; turnCount: number };

  expect(turn10Body.response.toLowerCase()).toContain('frank');
  expect(turn10Body.turnCount).toBe(10);
});

// ---------------------------------------------------------------------------
// Test 6: Topic Switch Handling
// Rapid topic changes must not cause the agent to confuse information from
// different topics (e.g., colour preference vs. stored name).
// ---------------------------------------------------------------------------
test('topic switch handling — rapid topic changes do not confuse context', async ({ request }) => {
  const sessionId = uniqueSessionId('topic-switch');

  // Introduce name
  const nameResp = await request.post('/chat', {
    data: { sessionId, message: 'My name is Grace' },
  });
  const nameBody = await nameResp.json() as { response: string; turnCount: number };
  expect(nameBody.response.toLowerCase()).toContain('grace');

  // Switch: weather
  await request.post('/chat', { data: { sessionId, message: 'What about the weather?' } });

  // Switch: colour
  const colourRaw = await request.post('/chat', {
    data: { sessionId, message: 'What is your favorite color?' },
  });
  const colourBody = await colourRaw.json() as { response: string };
  // The colour response must NOT accidentally contain the stored name
  // (regression guard against context bleed in topic handling)
  expect(colourBody.response.toLowerCase()).not.toContain('grace');

  // Switch back to identity
  const nameAgainRaw = await request.post('/chat', {
    data: { sessionId, message: 'What is my name?' },
  });
  const nameAgainBody = await nameAgainRaw.json() as { response: string };
  expect(nameAgainBody.response.toLowerCase()).toContain('grace');
});

// ---------------------------------------------------------------------------
// Test 7: Full Conversation Flow Helper
// Uses the runConversation helper to drive a complete scenario end-to-end
// and asserts on the final session state via GET /session.
// ---------------------------------------------------------------------------
test('full conversation flow using runConversation helper', async ({ request }) => {
  const sessionId = uniqueSessionId('full-flow');

  const result = await runConversation(request, sessionId, [
    { message: 'Hi there!', expectedInResponse: 'hello' },
    { message: 'My name is Henry' },
    { message: 'What is the weather like?', expectedInResponse: 'weather' },
    { message: 'What is my name?', expectedInResponse: 'Henry' },
    { message: 'How many messages have we sent?', expectedInResponse: '5' },
  ]);

  // 5 turns completed
  expect(result.finalTurnCount).toBe(5);
  // All turns recorded in result
  expect(result.turns).toHaveLength(5);

  // Verify final session state via the metadata endpoint
  const metaRaw = await request.get(`/session/${sessionId}`);
  const meta = await metaRaw.json() as { turnCount: number; hasName: boolean };
  expect(meta.turnCount).toBe(5);
  expect(meta.hasName).toBe(true);
});

// ---------------------------------------------------------------------------
// Bonus: DELETE /session clears session state
// ---------------------------------------------------------------------------
test('DELETE /session clears session so GET returns zeroed state', async ({ request }) => {
  const sessionId = uniqueSessionId('delete-test');

  // Create session with some state
  await request.post('/chat', { data: { sessionId, message: 'My name is Ivy' } });
  await request.post('/chat', { data: { sessionId, message: 'Hello again' } });

  const beforeDelete = await request.get(`/session/${sessionId}`);
  const beforeMeta = await beforeDelete.json() as { turnCount: number; hasName: boolean };
  expect(beforeMeta.turnCount).toBe(2);
  expect(beforeMeta.hasName).toBe(true);

  // Delete
  const deleteRaw = await request.delete(`/session/${sessionId}`);
  expect(deleteRaw.ok()).toBe(true);

  // After deletion the endpoint returns the zero state
  const afterDelete = await request.get(`/session/${sessionId}`);
  const afterMeta = await afterDelete.json() as { turnCount: number; hasName: boolean };
  expect(afterMeta.turnCount).toBe(0);
  expect(afterMeta.hasName).toBe(false);
});
