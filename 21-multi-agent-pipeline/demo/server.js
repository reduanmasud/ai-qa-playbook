const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// In-memory pipeline store
// ---------------------------------------------------------------------------
/** @type {Map<string, object>} */
const pipelineStore = new Map();

// ---------------------------------------------------------------------------
// Agent implementations
// ---------------------------------------------------------------------------

/**
 * Planner agent.
 * Takes a topic string and produces a structured plan.
 *
 * @param {string} topic
 * @returns {{ plan: string[], estimatedSteps: number }}
 */
function runPlanner(topic) {
  if (!topic || typeof topic !== 'string' || topic.trim() === '') {
    throw new Error('Planner requires a non-empty topic string.');
  }

  const trimmed = topic.trim().toLowerCase();

  // Deterministic but realistic mock plan derived from the topic
  const baseSteps = [
    `Define the scope of "${trimmed}"`,
    `Identify key subtopics within "${trimmed}"`,
    `Outline research questions for "${trimmed}"`,
    `Determine primary sources relevant to "${trimmed}"`,
    `Structure the final deliverable around "${trimmed}"`,
  ];

  // Vary the plan length slightly based on topic length (3–5 steps)
  const stepCount = 3 + (trimmed.length % 3);
  const plan = baseSteps.slice(0, stepCount);

  return {
    plan,
    estimatedSteps: plan.length,
  };
}

/**
 * Researcher agent.
 * Takes the planner's plan array and produces findings.
 *
 * @param {{ plan: string[], estimatedSteps: number }} plannerOutput
 * @returns {{ findings: string[], sources: number }}
 */
function runResearcher(plannerOutput) {
  if (!plannerOutput || !Array.isArray(plannerOutput.plan) || plannerOutput.plan.length === 0) {
    throw new Error('Researcher requires a plan array from the planner stage.');
  }

  const findings = plannerOutput.plan.map((step, idx) => {
    return `Finding ${idx + 1}: Research completed for step — "${step}". Key insight discovered.`;
  });

  // sources is always at least 1 per plan step, plus a small bonus
  const sources = plannerOutput.plan.length + 2;

  return {
    findings,
    sources,
  };
}

/**
 * Writer agent.
 * Takes the researcher's findings array and produces written content.
 *
 * @param {{ findings: string[], sources: number }} researcherOutput
 * @returns {{ content: string, wordCount: number }}
 */
function runWriter(researcherOutput) {
  if (
    !researcherOutput ||
    !Array.isArray(researcherOutput.findings) ||
    researcherOutput.findings.length === 0
  ) {
    throw new Error('Writer requires a findings array from the researcher stage.');
  }

  const intro = 'This report synthesizes the key research findings on the given topic.';
  const body = researcherOutput.findings
    .map((finding, idx) => `Section ${idx + 1}: ${finding}`)
    .join(' ');
  const conclusion = `In conclusion, ${researcherOutput.sources} sources were consulted to produce this analysis.`;

  const content = `${intro} ${body} ${conclusion}`;
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return {
    content,
    wordCount,
  };
}

// ---------------------------------------------------------------------------
// Agent dispatcher — run a single stage by name
// ---------------------------------------------------------------------------

/**
 * Run a single named agent with the given input.
 *
 * @param {'planner'|'researcher'|'writer'} stage
 * @param {any} input
 * @returns {{ output: any, durationMs: number }}
 */
function runStage(stage, input) {
  const start = Date.now();

  let output;
  switch (stage) {
    case 'planner':
      output = runPlanner(input);
      break;
    case 'researcher':
      output = runResearcher(input);
      break;
    case 'writer':
      output = runWriter(input);
      break;
    default:
      throw new Error(`Unknown stage: "${stage}". Valid stages: planner, researcher, writer.`);
  }

  const durationMs = Date.now() - start;
  return { output, durationMs };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /pipeline/run
 * Body:    { topic: string }
 * Returns: {
 *   pipelineId: string,
 *   stages: Array<{ agent: string, input: any, output: any, durationMs: number }>,
 *   finalOutput: string
 * }
 *
 * Runs all three agents in sequence: planner → researcher → writer.
 * Stores the result by pipelineId for later retrieval.
 */
app.post('/pipeline/run', (req, res) => {
  const { topic } = req.body;

  if (typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic must be a string' });
  }

  if (topic.trim() === '') {
    return res.status(400).json({ error: 'topic must not be empty' });
  }

  const pipelineId = crypto.randomUUID();
  const stages = [];

  try {
    // Stage 1: Planner
    const plannerInput = topic;
    const plannerResult = runStage('planner', plannerInput);
    stages.push({
      agent: 'planner',
      input: plannerInput,
      output: plannerResult.output,
      durationMs: plannerResult.durationMs,
    });

    // Stage 2: Researcher — receives planner's full output as input
    const researcherInput = plannerResult.output;
    const researcherResult = runStage('researcher', researcherInput);
    stages.push({
      agent: 'researcher',
      input: researcherInput,
      output: researcherResult.output,
      durationMs: researcherResult.durationMs,
    });

    // Stage 3: Writer — receives researcher's full output as input
    const writerInput = researcherResult.output;
    const writerResult = runStage('writer', writerInput);
    stages.push({
      agent: 'writer',
      input: writerInput,
      output: writerResult.output,
      durationMs: writerResult.durationMs,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const finalOutput = stages[stages.length - 1].output.content;

  const result = { pipelineId, stages, finalOutput };
  pipelineStore.set(pipelineId, result);

  return res.json(result);
});

/**
 * POST /pipeline/run-stage
 * Body:    { stage: "planner"|"researcher"|"writer", input: any }
 * Returns: { agent: string, input: any, output: any, durationMs: number }
 *
 * Runs exactly one agent in isolation.
 */
app.post('/pipeline/run-stage', (req, res) => {
  const { stage, input } = req.body;

  if (typeof stage !== 'string') {
    return res.status(400).json({ error: 'stage must be a string' });
  }

  const validStages = ['planner', 'researcher', 'writer'];
  if (!validStages.includes(stage)) {
    return res
      .status(400)
      .json({ error: `stage must be one of: ${validStages.join(', ')}` });
  }

  if (input === undefined || input === null) {
    return res.status(400).json({ error: 'input is required' });
  }

  try {
    const { output, durationMs } = runStage(stage, input);
    return res.json({ agent: stage, input, output, durationMs });
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

/**
 * GET /pipeline/:pipelineId
 * Returns the stored pipeline result by ID.
 */
app.get('/pipeline/:pipelineId', (req, res) => {
  const { pipelineId } = req.params;

  const result = pipelineStore.get(pipelineId);
  if (!result) {
    return res.status(404).json({ error: `Pipeline "${pipelineId}" not found.` });
  }

  return res.json(result);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = 3021;
app.listen(PORT, () =>
  console.log(`Multi-Agent Pipeline demo server running at http://localhost:${PORT}`)
);
