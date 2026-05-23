import { test, expect } from '@playwright/test';
import { findToolCall, computeToolCallAccuracy, TrajectoryStep } from './helpers/trajectory';

const BASE_URL = 'http://localhost:3016';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runAgent(
  request: import('@playwright/test').APIRequestContext,
  task: string
): Promise<{ trajectory: TrajectoryStep[]; finalAnswer: string }> {
  const response = await request.post(`${BASE_URL}/agent/run`, {
    data: { task },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

// ---------------------------------------------------------------------------
// Test 1: Correct tool selection — weather task
// ---------------------------------------------------------------------------

test('correct tool selection: weather task routes to get_weather', async ({ request }) => {
  const { trajectory } = await runAgent(request, 'What is the weather in London?');

  const weatherStep = findToolCall(trajectory, 'get_weather');
  expect(weatherStep).toBeDefined();
  expect(weatherStep!.input).toHaveProperty('city', 'London');
});

// ---------------------------------------------------------------------------
// Test 2: Tool parameter correctness — calculate task
// ---------------------------------------------------------------------------

test('tool parameter correctness: calculate task passes the expression', async ({ request }) => {
  const { trajectory } = await runAgent(request, 'Calculate 15 * 7');

  const calcStep = findToolCall(trajectory, 'calculate');
  expect(calcStep).toBeDefined();

  // The expression forwarded to the tool must include both 15 and 7.
  const expression = String(calcStep!.input.expression);
  expect(expression).toContain('15');
  expect(expression).toContain('7');

  // The result should equal 105.
  expect(calcStep!.output).toHaveProperty('result', 105);
});

// ---------------------------------------------------------------------------
// Test 3: Trajectory completeness — all required fields present
// ---------------------------------------------------------------------------

test('trajectory completeness: every step has step, tool, input, output', async ({ request }) => {
  const { trajectory } = await runAgent(request, 'Tell me about quantum computing');

  expect(trajectory.length).toBeGreaterThan(0);

  for (const step of trajectory) {
    expect(typeof step.step).toBe('number');
    expect(typeof step.tool).toBe('string');
    expect(step.tool.length).toBeGreaterThan(0);
    expect(step.input).toBeDefined();
    expect(typeof step.input).toBe('object');
    expect(step.output).toBeDefined();
    expect(typeof step.output).toBe('object');
  }
});

// ---------------------------------------------------------------------------
// Test 4: Tool call count — simple single-step tasks use at most 1 tool
// ---------------------------------------------------------------------------

test('tool call count: a simple single-step task uses no more than 1 tool call', async ({ request }) => {
  const tasks = [
    'What is the weather in Paris?',
    'Calculate 10 + 20',
    'Search for the history of the internet',
  ];

  for (const task of tasks) {
    const { trajectory } = await runAgent(request, task);
    expect(trajectory.length).toBeLessThanOrEqual(1);
  }
});

// ---------------------------------------------------------------------------
// Test 5: Final answer references tool output
// ---------------------------------------------------------------------------

test('final answer uses tool output: weather answer contains temperature', async ({ request }) => {
  const { trajectory, finalAnswer } = await runAgent(request, 'What is the weather in Tokyo?');

  const weatherStep = findToolCall(trajectory, 'get_weather');
  expect(weatherStep).toBeDefined();

  // The final answer should mention the city returned in the tool output.
  const city = String(weatherStep!.output.city);
  expect(finalAnswer.toLowerCase()).toContain(city.toLowerCase());

  // The final answer should also mention the temperature value.
  const temperature = String(weatherStep!.output.temperature);
  expect(finalAnswer).toContain(temperature);
});

test('final answer uses tool output: calculate answer contains the numeric result', async ({
  request,
}) => {
  const { trajectory, finalAnswer } = await runAgent(request, 'Calculate 8 * 9');

  const calcStep = findToolCall(trajectory, 'calculate');
  expect(calcStep).toBeDefined();

  const result = String(calcStep!.output.result);
  expect(finalAnswer).toContain(result);
});

// ---------------------------------------------------------------------------
// Test 6: GET /tools returns valid tool list
// ---------------------------------------------------------------------------

test('available tools endpoint: GET /tools returns an array with name and description', async ({
  request,
}) => {
  const response = await request.get(`${BASE_URL}/tools`);
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body).toHaveProperty('tools');
  expect(Array.isArray(body.tools)).toBe(true);
  expect(body.tools.length).toBeGreaterThan(0);

  for (const tool of body.tools) {
    expect(typeof tool.name).toBe('string');
    expect(tool.name.length).toBeGreaterThan(0);
    expect(typeof tool.description).toBe('string');
    expect(tool.description.length).toBeGreaterThan(0);
  }
});

test('available tools endpoint: known tools are present by name', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/tools`);
  const { tools } = await response.json();
  const names: string[] = tools.map((t: { name: string }) => t.name);

  expect(names).toContain('search');
  expect(names).toContain('calculate');
  expect(names).toContain('get_weather');
});

// ---------------------------------------------------------------------------
// Test 7: Tool Call Accuracy (TCA) metric across 3 task types
// ---------------------------------------------------------------------------

test('TCA metric: accuracy is 100% across search, calculate, and weather tasks', async ({
  request,
}) => {
  const taskSuite: Array<{ task: string; expectedTool: string }> = [
    { task: 'What is the weather in Sydney?', expectedTool: 'get_weather' },
    { task: 'Calculate 100 / 4', expectedTool: 'calculate' },
    { task: 'Find information about the Roman Empire', expectedTool: 'search' },
  ];

  const comparisons: Array<{ expectedTool: string; actualTool: string }> = [];

  for (const { task, expectedTool } of taskSuite) {
    const { trajectory } = await runAgent(request, task);
    expect(trajectory.length).toBeGreaterThan(0);
    const actualTool = trajectory[0].tool;
    comparisons.push({ expectedTool, actualTool });
  }

  const accuracy = computeToolCallAccuracy(comparisons);
  console.log(`Tool Call Accuracy (TCA): ${accuracy}%`);

  // Require perfect accuracy for this deterministic mock agent.
  expect(accuracy).toBe(100);
});

// ---------------------------------------------------------------------------
// Test 8: Edge cases — invalid / empty task returns 400
// ---------------------------------------------------------------------------

test('edge case: empty task returns 400', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/agent/run`, {
    data: { task: '' },
  });
  expect(response.status()).toBe(400);
});

test('edge case: missing task field returns 400', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/agent/run`, {
    data: {},
  });
  expect(response.status()).toBe(400);
});

// ---------------------------------------------------------------------------
// Test 9: Search task routes correctly with default tool
// ---------------------------------------------------------------------------

test('correct tool selection: generic question routes to search', async ({ request }) => {
  const { trajectory } = await runAgent(request, 'Who invented the telephone?');

  const searchStep = findToolCall(trajectory, 'search');
  expect(searchStep).toBeDefined();
  expect(searchStep!.output).toHaveProperty('results');
  expect(Array.isArray((searchStep!.output as { results: unknown[] }).results)).toBe(true);
});

// ---------------------------------------------------------------------------
// Test 10: computeToolCallAccuracy helper unit-level validation
// ---------------------------------------------------------------------------

test('computeToolCallAccuracy helper: returns 0 for empty input', () => {
  expect(computeToolCallAccuracy([])).toBe(0);
});

test('computeToolCallAccuracy helper: returns 100 when all correct', () => {
  const results = [
    { expectedTool: 'search', actualTool: 'search' },
    { expectedTool: 'calculate', actualTool: 'calculate' },
  ];
  expect(computeToolCallAccuracy(results)).toBe(100);
});

test('computeToolCallAccuracy helper: returns 50 for half correct', () => {
  const results = [
    { expectedTool: 'search', actualTool: 'search' },
    { expectedTool: 'calculate', actualTool: 'search' },
  ];
  expect(computeToolCallAccuracy(results)).toBe(50);
});
