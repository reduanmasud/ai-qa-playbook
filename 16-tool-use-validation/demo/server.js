const express = require('express');
const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'search',
    description: 'Search the web for information about any topic. Accepts a query string and returns relevant results.',
  },
  {
    name: 'calculate',
    description: 'Evaluate a mathematical expression. Supports +, -, *, / and parentheses.',
  },
  {
    name: 'get_weather',
    description: 'Retrieve current weather conditions for a given city. Returns temperature, condition, and humidity.',
  },
];

// ---------------------------------------------------------------------------
// Tool implementations (all mock / deterministic)
// ---------------------------------------------------------------------------

function search(query) {
  const results = [
    { title: `Wikipedia: ${query}`, snippet: `${query} is a well-known topic with many facets.`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}` },
    { title: `Encyclopedia: ${query}`, snippet: `Learn everything about ${query} from authoritative sources.`, url: `https://encyclopedia.example.com/${encodeURIComponent(query)}` },
    { title: `News: Latest on ${query}`, snippet: `Recent developments related to ${query} in the past week.`, url: `https://news.example.com/search?q=${encodeURIComponent(query)}` },
  ];
  return { query, results };
}

function calculate(expression) {
  // Allow only digits, whitespace, and basic arithmetic operators / parentheses.
  const safe = /^[\d\s+\-*/().]+$/.test(expression);
  if (!safe) {
    return { expression, result: null, error: 'Unsafe expression rejected' };
  }
  try {
    // Use Function constructor so we avoid direct eval in global scope.
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expression})`)();
    if (typeof result !== 'number' || !isFinite(result)) {
      return { expression, result: null, error: 'Result is not a finite number' };
    }
    return { expression, result };
  } catch {
    return { expression, result: null, error: 'Failed to evaluate expression' };
  }
}

const WEATHER_DB = {
  london:   { city: 'London',   temperature: 15, unit: 'C', condition: 'Cloudy',  humidity: 72 },
  paris:    { city: 'Paris',    temperature: 18, unit: 'C', condition: 'Sunny',   humidity: 58 },
  new_york: { city: 'New York', temperature: 22, unit: 'C', condition: 'Partly cloudy', humidity: 65 },
  tokyo:    { city: 'Tokyo',    temperature: 26, unit: 'C', condition: 'Clear',   humidity: 70 },
  sydney:   { city: 'Sydney',   temperature: 19, unit: 'C', condition: 'Windy',   humidity: 60 },
};

function get_weather(city) {
  const key = city.toLowerCase().replace(/\s+/g, '_');
  const data = WEATHER_DB[key];
  if (data) {
    return data;
  }
  return {
    city,
    temperature: 20,
    unit: 'C',
    condition: 'Unknown',
    humidity: 55,
    note: 'City not found in database — returning default values.',
  };
}

// ---------------------------------------------------------------------------
// Agent routing logic
// ---------------------------------------------------------------------------

/**
 * Decide which tool to call based on the task description.
 * Returns { tool, input }.
 */
function routeTask(task) {
  const lower = task.toLowerCase();

  if (lower.includes('weather')) {
    // Extract city: look for "in <City>" or "for <City>"
    const cityMatch = lower.match(/(?:weather\s+(?:in|for|at)\s+)([a-z\s]+)/i);
    const rawCity = cityMatch ? cityMatch[1].trim() : 'London';
    // Title-case the city
    const city = rawCity
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return { tool: 'get_weather', input: { city } };
  }

  if (/[\d]/.test(task) && /[+\-*/]/.test(task)) {
    // Extract the mathematical expression from the task.
    const exprMatch = task.match(/([\d\s+\-*/().]+)/);
    const expression = exprMatch ? exprMatch[1].trim() : task;
    return { tool: 'calculate', input: { expression } };
  }

  // Default: search
  const query = task.replace(/^(search|find|look up|what is|who is|tell me about)\s+/i, '').trim();
  return { tool: 'search', input: { query: query || task } };
}

/**
 * Execute a single tool call.
 */
function executeTool(tool, input) {
  switch (tool) {
    case 'search':
      return search(input.query);
    case 'calculate':
      return calculate(input.expression);
    case 'get_weather':
      return get_weather(input.city);
    default:
      return { error: `Unknown tool: ${tool}` };
  }
}

/**
 * Build a natural-language final answer from the tool output.
 */
function buildFinalAnswer(tool, input, output) {
  switch (tool) {
    case 'get_weather':
      return `The current weather in ${output.city} is ${output.condition} with a temperature of ${output.temperature}°${output.unit} and humidity at ${output.humidity}%.`;
    case 'calculate':
      if (output.error) {
        return `I was unable to calculate "${input.expression}": ${output.error}`;
      }
      return `The result of ${input.expression} is ${output.result}.`;
    case 'search':
      if (output.results && output.results.length > 0) {
        return `Here are some results for "${output.query}": ${output.results[0].snippet}`;
      }
      return `No results found for "${output.query}".`;
    default:
      return 'Task completed.';
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.post('/agent/run', (req, res) => {
  const { task } = req.body;

  if (!task || typeof task !== 'string' || task.trim() === '') {
    return res.status(400).json({ error: 'task field is required and must be a non-empty string' });
  }

  const { tool, input } = routeTask(task);
  const output = executeTool(tool, input);

  const trajectory = [
    {
      step: 1,
      tool,
      input,
      output,
    },
  ];

  const finalAnswer = buildFinalAnswer(tool, input, output);

  res.json({ trajectory, finalAnswer });
});

app.get('/tools', (_req, res) => {
  res.json({ tools: TOOLS });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3016, () => {
  console.log('Tool-use validation demo server running at http://localhost:3016');
});
