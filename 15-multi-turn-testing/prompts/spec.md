# Spec: Multi-Turn Conversation Testing

## Overview

A multi-turn conversation is a sequence of messages exchanged between a user and an AI agent within a single session. Unlike a single API call, a conversation has *state* that evolves across turns. This spec defines the expected behaviour of the chat server and what the tests must verify.

---

## Server Behaviour (`POST /chat`)

**Inputs**
- `sessionId` (string, required) — uniquely identifies the conversation session
- `message` (string, required) — the user's message for this turn

**Outputs**
- `response` (string) — the agent's reply
- `turnCount` (number) — how many user messages have been processed in this session so far

**Session management rules**
1. Sessions are created on first use; no pre-registration needed.
2. Each `POST /chat` increments `turnCount` by 1.
3. If the user states their name ("my name is X"), the agent stores it for the rest of the session.
4. If the user asks "what is my name?", the agent returns the stored name, or says it does not know.
5. If the user says "start over" or "clear session", the session is fully reset: `turnCount` goes to 0 and all stored information is erased.

---

## Session Metadata (`GET /session/:sessionId`)

Returns:
- `turnCount` (number) — messages processed (0 if session does not exist)
- `hasName` (boolean) — whether the agent has a stored name for this session

---

## Session Deletion (`DELETE /session/:sessionId`)

Removes the session from the store. After deletion, `GET /session/:sessionId` returns `{ turnCount: 0, hasName: false }`.

---

## Test Scenarios

### 1. Context Retention
Send three turns:
1. "My name is Alice"
2. An unrelated message (e.g., weather question)
3. "What is my name?"

**Expected**: Turn 3 response contains "Alice".

### 2. Session Isolation
Create two sessions concurrently. In session A, state a name. In session B, ask for the name.

**Expected**: Session B does not return session A's name.

### 3. Turn Count Tracking
Send exactly 5 messages.

**Expected**: `turnCount` after each message equals the message's position (1, 2, 3, 4, 5). `GET /session` confirms `turnCount: 5`.

### 4. Session Reset
State a name, confirm it is remembered, send "start over", then ask for the name again.

**Expected**: After reset, the agent does not recall the name. `turnCount` returns to 0.

### 5. Context Window Simulation
Send 10 messages. Turn 1 states a name. Turns 2–9 are unrelated filler. Turn 10 asks for the name.

**Expected**: Turn 10 response still contains the name from turn 1. `turnCount` is 10.

### 6. Topic Switch Handling
Rapidly alternate between identity ("my name is Grace"), weather, colour, and back to identity.

**Expected**: The agent does not confuse topics. Name is returned correctly when asked. Topic responses do not bleed the stored name into unrelated answers.

### 7. Full Conversation Flow (helper-driven)
Use the `runConversation` helper to execute a 5-turn scenario with inline assertions on each turn's response.

**Expected**: All assertions pass. Final session metadata matches expected state.

---

## Acceptance Criteria

- All seven test scenarios pass with zero flakiness on repeated runs.
- Sessions created in one test must not affect sessions in another test (use unique session IDs per test).
- The `runConversation` helper correctly surfaces assertion failures with readable messages.
- The server starts and stops cleanly within Playwright's `webServer` lifecycle.
