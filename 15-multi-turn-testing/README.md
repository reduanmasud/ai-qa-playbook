# Tutorial 15: Multi-Turn Conversation Testing

## What This Tutorial Covers

Most AI testing tutorials stop at single-turn tests: send one request, check one response. But production AI agents rarely operate in a vacuum. Users ask follow-up questions. They change their minds. They circle back to earlier topics. These multi-turn dynamics introduce a whole class of bugs that single-turn tests simply cannot catch.

This tutorial teaches you to test **conversations as first-class units**, not just individual API calls.

---

## Why Single-Turn Tests Miss Critical Bugs

A single-turn test looks like this:

```
Send: "What is my name?"
Expect: agent says it does not know
```

That passes. But now consider a two-turn sequence:

```
Turn 1 — Send: "My name is Alice"    → agent confirms
Turn 2 — Send: "What is my name?"   → agent says "I don't know your name"
```

This is a **context retention failure** — the agent forgot information from the previous turn. A single-turn test for "What is my name?" will pass while the bug goes undetected.

Multi-turn testing surfaces:

| Bug type | What it looks like |
|---|---|
| Context retention failure | Agent forgets what the user said earlier |
| Context bleed | Agent uses a value from one session/topic in a different session/topic |
| State corruption | Internal session counters or fields get out of sync |
| Premature truncation | Agent "forgets" early turns once the conversation grows long |
| Reset failure | `start over` is acknowledged but prior state persists |

---

## Key Testing Patterns

### Context Retention

The core pattern: state information in turn N, do something unrelated in turns N+1 to N+K, then query the information in turn N+K+1.

```
Turn 1: "My name is Alice"      → confirmed
Turn 2: "What's the weather?"   → weather response (no assertion on name)
Turn 3: "What is my name?"      → must return "Alice"
```

### Contradiction Detection

State a fact, then state a conflicting fact, then query which is current. The agent should use the most recently stated value (or flag the contradiction explicitly).

```
Turn 1: "My name is Alice"
Turn 2: "Actually, call me Alicia"
Turn 3: "What is my name?"   → expect "Alicia", not "Alice"
```

### Session Isolation

Run two sessions in parallel with different data. Verify that information from session A never appears in session B. This is essential for multi-user or multi-tenant systems.

### Turn Count Validation

The `turnCount` field gives you a cheap sanity check: if turn 5 returns `turnCount: 3`, something is wrong with session tracking. Always assert on this field.

---

## How Conversation Length Affects Testing Strategy

Short conversations (1–5 turns) test basic context retention — the kind of memory any stateful session should provide.

Medium conversations (5–20 turns) start to stress session management. You can test:
- Whether early context survives many subsequent turns
- Whether topic switches cause confusion
- Whether the agent's tone or persona drifts over time

Long conversations (20+ turns) are where real LLMs face their hardest challenge: the **context window limit**.

---

## The Turn Budget Concept

Real large language models (LLMs) accept a fixed-size context window — typically measured in tokens. Every message in the conversation consumes tokens. Once the conversation exceeds the window, one of two things happens:

1. **Truncation**: The oldest messages are dropped silently. The agent appears to "forget" early turns.
2. **Error**: The API returns an error because the prompt is too large.

As a test engineer you must:

- Know the context window size for the model under test (e.g., 200 K tokens for Claude, 128 K for GPT-4o).
- Test at the boundary: does the agent still recall turn 1 when the conversation is near the limit?
- Test past the boundary: how does the system handle overflow? Does it truncate gracefully? Does it prioritise recent context? Does it summarise older turns?

The "context window simulation" test in this tutorial (test 5) is a simplified version of this: it sends 10 turns and verifies turn-1 context is still accessible. In production you would scale this to hundreds of turns.

---

## Connection to Agent Memory Systems

Modern AI agents often implement structured memory to extend beyond the context window:

| Memory type | Description | Testing implication |
|---|---|---|
| **Episodic memory** | Specific past events ("the user said X at turn 3") | Test that specific facts persist across many turns |
| **Semantic memory** | General knowledge distilled from past turns ("the user prefers concise answers") | Test that preferences are applied consistently |
| **Procedural memory** | Learned workflows ("the user always wants JSON output") | Test that the agent follows the established pattern even in novel situations |

When testing agents with external memory (vector databases, key-value stores, summarisers), multi-turn tests become integration tests. Verify:

- Memory is written after the relevant turn
- Memory is read correctly before generating the response
- Memory survives server restarts (if that is a requirement)
- Memory from session A is not readable by session B (isolation at the storage layer)

---

## Running the Tests

```bash
# From the repository root
npx playwright test --config=15-multi-turn-testing/playwright.config.ts
```

The Playwright `webServer` config starts `demo/server.js` on port 3015 automatically before running any tests.

To run an individual test file:

```bash
npx playwright test --config=15-multi-turn-testing/playwright.config.ts tests/multi-turn.spec.ts
```

---

## File Structure

```
15-multi-turn-testing/
├── demo/
│   └── server.js              # Express mock chat server (port 3015)
├── tests/
│   ├── helpers/
│   │   └── conversation.ts    # runConversation() helper + uniqueSessionId()
│   └── multi-turn.spec.ts     # All test scenarios
├── prompts/
│   └── spec.md                # Plain-English specification
├── playwright.config.ts       # Playwright config with webServer
└── README.md                  # This file
```

---

## Key Takeaways

1. **Test conversations, not just messages.** A passing single-turn test does not guarantee multi-turn correctness.
2. **Use unique session IDs per test** to eliminate cross-test contamination.
3. **Assert on `turnCount`** as a cheap structural health check on session state.
4. **Test the reset path explicitly** — it is a common source of partial-state bugs.
5. **Simulate long conversations** to surface context window and memory management issues.
6. **Isolate sessions in parallel tests** to catch data-layer bleed bugs.
