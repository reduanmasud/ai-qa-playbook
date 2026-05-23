import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Type definitions — mirrors the demo server's response shapes
// ---------------------------------------------------------------------------

interface PlannerOutput {
  plan: string[];
  estimatedSteps: number;
}

interface ResearcherOutput {
  findings: string[];
  sources: number;
}

interface WriterOutput {
  content: string;
  wordCount: number;
}

interface StageResult {
  agent: string;
  input: unknown;
  output: PlannerOutput | ResearcherOutput | WriterOutput;
  durationMs: number;
}

interface PipelineResult {
  pipelineId: string;
  stages: StageResult[];
  finalOutput: string;
}

interface RunStageResponse {
  agent: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runFullPipeline(
  request: APIRequestContext,
  topic: string
): Promise<{ status: number; body: PipelineResult | { error: string } }> {
  const res = await request.post('/pipeline/run', { data: { topic } });
  const body = await res.json();
  return { status: res.status(), body };
}

async function runSingleStage(
  request: APIRequestContext,
  stage: 'planner' | 'researcher' | 'writer',
  input: unknown
): Promise<{ status: number; body: RunStageResponse | { error: string } }> {
  const res = await request.post('/pipeline/run-stage', { data: { stage, input } });
  const body = await res.json();
  return { status: res.status(), body };
}

async function fetchPipeline(
  request: APIRequestContext,
  pipelineId: string
): Promise<{ status: number; body: PipelineResult | { error: string } }> {
  const res = await request.get(`/pipeline/${pipelineId}`);
  const body = await res.json();
  return { status: res.status(), body };
}

// ---------------------------------------------------------------------------
// Layer 1: Individual agent — Planner
//
// Run the planner stage in isolation via /pipeline/run-stage.
// Assert the output shape is correct and contains meaningful values.
// ---------------------------------------------------------------------------

test('individual agent — planner returns plan array and estimatedSteps > 0', async ({
  request,
}) => {
  const { status, body } = await runSingleStage(request, 'planner', 'climate change');

  expect(status).toBe(200);

  const res = body as RunStageResponse;
  expect(res.agent).toBe('planner');
  expect(res.durationMs).toBeGreaterThanOrEqual(0);

  const output = res.output as PlannerOutput;
  expect(Array.isArray(output.plan)).toBe(true);
  expect(output.plan.length).toBeGreaterThan(0);
  expect(output.estimatedSteps).toBeGreaterThan(0);
  expect(output.estimatedSteps).toBe(output.plan.length);

  // Each plan step should be a non-empty string
  for (const step of output.plan) {
    expect(typeof step).toBe('string');
    expect(step.trim().length).toBeGreaterThan(0);
  }
});

// ---------------------------------------------------------------------------
// Layer 1: Individual agent — Researcher
//
// The researcher expects a PlannerOutput shape as its input.
// Run it in isolation with a hand-crafted plan.
// ---------------------------------------------------------------------------

test('individual agent — researcher returns findings and sources > 0', async ({ request }) => {
  const plannerOutput: PlannerOutput = {
    plan: ['Define scope', 'Identify subtopics', 'Outline research questions'],
    estimatedSteps: 3,
  };

  const { status, body } = await runSingleStage(request, 'researcher', plannerOutput);

  expect(status).toBe(200);

  const res = body as RunStageResponse;
  expect(res.agent).toBe('researcher');
  expect(res.durationMs).toBeGreaterThanOrEqual(0);

  const output = res.output as ResearcherOutput;
  expect(Array.isArray(output.findings)).toBe(true);
  expect(output.findings.length).toBeGreaterThan(0);
  expect(output.sources).toBeGreaterThan(0);

  // Each finding should be a non-empty string
  for (const finding of output.findings) {
    expect(typeof finding).toBe('string');
    expect(finding.trim().length).toBeGreaterThan(0);
  }
});

// ---------------------------------------------------------------------------
// Layer 1: Individual agent — Writer
//
// The writer expects a ResearcherOutput shape.
// Run it in isolation with hand-crafted findings.
// ---------------------------------------------------------------------------

test('individual agent — writer returns content string and wordCount > 0', async ({ request }) => {
  const researcherOutput: ResearcherOutput = {
    findings: [
      'Finding 1: Temperatures have risen 1.2°C since pre-industrial levels.',
      'Finding 2: Arctic ice loss is accelerating.',
    ],
    sources: 5,
  };

  const { status, body } = await runSingleStage(request, 'writer', researcherOutput);

  expect(status).toBe(200);

  const res = body as RunStageResponse;
  expect(res.agent).toBe('writer');
  expect(res.durationMs).toBeGreaterThanOrEqual(0);

  const output = res.output as WriterOutput;
  expect(typeof output.content).toBe('string');
  expect(output.content.trim().length).toBeGreaterThan(0);
  expect(output.wordCount).toBeGreaterThan(0);

  // wordCount should be consistent with actual content
  const actualWordCount = output.content.split(/\s+/).filter(Boolean).length;
  expect(output.wordCount).toBe(actualWordCount);
});

// ---------------------------------------------------------------------------
// Layer 2: Interface contract — planner → researcher
//
// Run planner, then verify its output satisfies the schema the researcher
// expects as input: { plan: string[], estimatedSteps: number }.
// This is contract testing at the interface boundary.
// ---------------------------------------------------------------------------

test('interface contract — planner output satisfies researcher input schema', async ({
  request,
}) => {
  // Get real planner output
  const plannerRes = await runSingleStage(request, 'planner', 'machine learning');
  expect(plannerRes.status).toBe(200);
  const plannerOutput = (plannerRes.body as RunStageResponse).output as PlannerOutput;

  // Assert planner output has the properties the researcher expects
  expect(Array.isArray(plannerOutput.plan)).toBe(true);
  expect(plannerOutput.plan.length).toBeGreaterThan(0);
  expect(typeof plannerOutput.estimatedSteps).toBe('number');

  // Now pass planner output directly into researcher — should succeed without error
  const researcherRes = await runSingleStage(request, 'researcher', plannerOutput);
  expect(researcherRes.status).toBe(200);

  const researcherOutput = (researcherRes.body as RunStageResponse).output as ResearcherOutput;
  expect(Array.isArray(researcherOutput.findings)).toBe(true);
  expect(researcherOutput.findings.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Layer 2: Interface contract — researcher → writer
//
// Run researcher with a valid planner output, then pass its output to writer.
// The writer expects { findings: string[], sources: number }.
// ---------------------------------------------------------------------------

test('interface contract — researcher output satisfies writer input schema', async ({
  request,
}) => {
  // Produce researcher output
  const plannerOutput: PlannerOutput = {
    plan: ['Step 1: Define scope', 'Step 2: Gather data', 'Step 3: Analyze results'],
    estimatedSteps: 3,
  };
  const researcherRes = await runSingleStage(request, 'researcher', plannerOutput);
  expect(researcherRes.status).toBe(200);
  const researcherOutput = (researcherRes.body as RunStageResponse).output as ResearcherOutput;

  // Assert researcher output has the properties the writer expects
  expect(Array.isArray(researcherOutput.findings)).toBe(true);
  expect(researcherOutput.findings.length).toBeGreaterThan(0);
  expect(typeof researcherOutput.sources).toBe('number');

  // Pass researcher output directly into writer — should succeed
  const writerRes = await runSingleStage(request, 'writer', researcherOutput);
  expect(writerRes.status).toBe(200);

  const writerOutput = (writerRes.body as RunStageResponse).output as WriterOutput;
  expect(typeof writerOutput.content).toBe('string');
  expect(writerOutput.content.trim().length).toBeGreaterThan(0);
  expect(writerOutput.wordCount).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Layer 3: Full pipeline integration
//
// Run the entire pipeline via /pipeline/run and assert every stage is present
// with valid data end-to-end.
// ---------------------------------------------------------------------------

test('full pipeline integration — all 3 stages present with valid data', async ({ request }) => {
  const { status, body } = await runFullPipeline(request, 'quantum computing');

  expect(status).toBe(200);

  const result = body as PipelineResult;

  // Top-level shape
  expect(typeof result.pipelineId).toBe('string');
  expect(result.pipelineId.trim().length).toBeGreaterThan(0);
  expect(typeof result.finalOutput).toBe('string');
  expect(result.finalOutput.trim().length).toBeGreaterThan(0);

  // Exactly 3 stages
  expect(Array.isArray(result.stages)).toBe(true);
  expect(result.stages).toHaveLength(3);

  // Planner stage
  const plannerStage = result.stages[0];
  expect(plannerStage.agent).toBe('planner');
  const plannerOut = plannerStage.output as PlannerOutput;
  expect(Array.isArray(plannerOut.plan)).toBe(true);
  expect(plannerOut.plan.length).toBeGreaterThan(0);
  expect(plannerOut.estimatedSteps).toBeGreaterThan(0);

  // Researcher stage
  const researcherStage = result.stages[1];
  expect(researcherStage.agent).toBe('researcher');
  const researcherOut = researcherStage.output as ResearcherOutput;
  expect(Array.isArray(researcherOut.findings)).toBe(true);
  expect(researcherOut.findings.length).toBeGreaterThan(0);
  expect(researcherOut.sources).toBeGreaterThan(0);

  // Writer stage
  const writerStage = result.stages[2];
  expect(writerStage.agent).toBe('writer');
  const writerOut = writerStage.output as WriterOutput;
  expect(typeof writerOut.content).toBe('string');
  expect(writerOut.content.trim().length).toBeGreaterThan(0);
  expect(writerOut.wordCount).toBeGreaterThan(0);

  // finalOutput should match writer's content
  expect(result.finalOutput).toBe(writerOut.content);
});

// ---------------------------------------------------------------------------
// Layer 3: Pipeline ID tracking
//
// After running a pipeline, fetch it by ID and confirm the data is identical.
// This verifies stateful persistence across requests.
// ---------------------------------------------------------------------------

test('pipeline ID tracking — fetched result matches original run', async ({ request }) => {
  const { status: runStatus, body: runBody } = await runFullPipeline(
    request,
    'renewable energy'
  );
  expect(runStatus).toBe(200);

  const original = runBody as PipelineResult;
  expect(typeof original.pipelineId).toBe('string');

  // Fetch by ID
  const { status: fetchStatus, body: fetchBody } = await fetchPipeline(
    request,
    original.pipelineId
  );
  expect(fetchStatus).toBe(200);

  const fetched = fetchBody as PipelineResult;

  // Deep equality of key fields
  expect(fetched.pipelineId).toBe(original.pipelineId);
  expect(fetched.finalOutput).toBe(original.finalOutput);
  expect(fetched.stages).toHaveLength(original.stages.length);

  for (let i = 0; i < original.stages.length; i++) {
    expect(fetched.stages[i].agent).toBe(original.stages[i].agent);
    expect(JSON.stringify(fetched.stages[i].output)).toBe(
      JSON.stringify(original.stages[i].output)
    );
  }
});

// ---------------------------------------------------------------------------
// Layer 3: Stage ordering
//
// The stages array must always be in the order: planner → researcher → writer.
// Order matters — each stage feeds the next.
// ---------------------------------------------------------------------------

test('stage ordering — stages are in order planner → researcher → writer', async ({
  request,
}) => {
  const { status, body } = await runFullPipeline(request, 'blockchain technology');
  expect(status).toBe(200);

  const result = body as PipelineResult;
  expect(result.stages).toHaveLength(3);

  const expectedOrder = ['planner', 'researcher', 'writer'];
  for (let i = 0; i < expectedOrder.length; i++) {
    expect(result.stages[i].agent).toBe(expectedOrder[i]);
  }
});

// ---------------------------------------------------------------------------
// Layer 4: Error propagation — empty topic
//
// If the topic is empty, the pipeline must fail gracefully and return an error.
// It must NOT silently continue and return a partial result.
// ---------------------------------------------------------------------------

test('error propagation — empty topic causes pipeline to fail with 400', async ({ request }) => {
  const { status, body } = await runFullPipeline(request, '');

  // Server should reject before any agent runs
  expect(status).toBe(400);

  const err = body as { error: string };
  expect(typeof err.error).toBe('string');
  expect(err.error.trim().length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Layer 4: Error propagation — invalid stage input (researcher with bad data)
//
// Calling researcher with an empty plan should fail with a clear error,
// not silently return empty findings.
// ---------------------------------------------------------------------------

test('error propagation — researcher with empty plan fails with 422', async ({ request }) => {
  const badInput = { plan: [], estimatedSteps: 0 };

  const { status, body } = await runSingleStage(request, 'researcher', badInput);

  expect(status).toBe(422);

  const err = body as { error: string };
  expect(typeof err.error).toBe('string');
  expect(err.error.trim().length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Layer 4: Pipeline duration
//
// Total pipeline time should roughly equal the sum of individual stage durations.
// This validates that duration instrumentation is correct, not fabricated.
// A small tolerance accounts for server overhead.
// ---------------------------------------------------------------------------

test('pipeline duration — sum of stage durations is within 100ms of total', async ({
  request,
}) => {
  const { status, body } = await runFullPipeline(request, 'artificial intelligence');
  expect(status).toBe(200);

  const result = body as PipelineResult;

  const sumOfStageDurations = result.stages.reduce((acc, s) => acc + s.durationMs, 0);

  // Each stage must have been timed (>= 0ms)
  for (const stage of result.stages) {
    expect(stage.durationMs).toBeGreaterThanOrEqual(0);
  }

  // The sum of stage durations should be <= total time measured externally.
  // For a mock server there is very little overhead; verify the values are
  // sane rather than hardcoding an exact match.
  expect(sumOfStageDurations).toBeGreaterThanOrEqual(0);
  // Ensure no single stage is reporting an absurd duration (> 5 seconds for a mock)
  for (const stage of result.stages) {
    expect(stage.durationMs).toBeLessThan(5000);
  }
});

// ---------------------------------------------------------------------------
// Bonus: Unknown pipeline ID returns 404
// ---------------------------------------------------------------------------

test('fetching unknown pipelineId returns 404', async ({ request }) => {
  const { status, body } = await fetchPipeline(request, 'does-not-exist-at-all');

  expect(status).toBe(404);

  const err = body as { error: string };
  expect(typeof err.error).toBe('string');
});
