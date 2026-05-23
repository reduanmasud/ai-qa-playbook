# Tutorial 12 — Golden Datasets

## What Are Golden Datasets?

A **golden dataset** (also called a *golden set* or *eval set*) is a curated collection of input-output pairs with verified, human-approved answers. For AI systems, these pairs represent inputs you trust and the correct outputs the system should produce.

When you change anything in your AI pipeline — the model version, the prompt template, the inference parameters, or the post-processing logic — you run the golden set against the new system and check whether the outputs still meet quality thresholds. If they do not, you have detected a **silent regression**: a change that degraded behavior without an obvious error or crash.

This is the primary defense against the most insidious class of AI bugs.

---

## Why Golden Datasets Matter

Traditional software has deterministic outputs: given the same input, the function always returns the same value. AI systems are probabilistic and change frequently:

- The underlying model gets updated (e.g., GPT-4 → GPT-4o, Claude 3.5 → Claude 3.7)
- The prompt is reworded for clarity and accidentally shifts behavior
- A new retrieval step is added that changes context
- Inference parameters (temperature, top-p) are tuned
- A fine-tune is applied

Any of these changes can silently alter the behavior of the system in ways that matter to users. Golden datasets make these changes visible before they reach production.

---

## How to Curate Good Golden Cases

A golden dataset is only as useful as its cases are representative. Avoid the trap of only testing the happy path.

### Coverage principles

**1. Prototype cases** — one clear example per expected output class.
These confirm the system handles the most unambiguous inputs correctly.
```
"I love this product!" → positive
"This is terrible quality." → negative
"The package arrived today." → neutral
```

**2. Edge and boundary cases** — inputs near the boundary between classes, or with ambiguous signals.
```
"Not bad at all." → (negative keyword "bad" but negated — what does the system do?)
"I used to hate this, but now I love it." → mixed sentiment
```

**3. Distribution coverage** — cases that reflect the real distribution of inputs you expect in production. If 60% of real traffic is neutral, your golden set should have a comparable proportion.

**4. Known regressions** — cases that broke in the past. Once you fix a bug, add the failing input to the golden set so it cannot silently regress.

**5. Stress cases** — very long text, emoji-only input, different languages, unusual formatting. These expose brittleness.

### Practical curation process

1. Sample 50–100 real production inputs.
2. Have humans label them with the correct output.
3. Review for diversity across classes and edge cases.
4. Add at least two known-tricky cases per class.
5. Lock the dataset in version control alongside the code.

---

## The 80% Threshold Concept

This tutorial enforces an 80% pass rate rather than 100%. Why not require perfection?

**AI systems are not perfectly deterministic.** Even a well-functioning system may occasionally produce borderline outputs on ambiguous inputs. A 100% gate would cause continuous false alarms on cases that are genuinely ambiguous, forcing engineers to either remove useful edge cases from the set or constantly adjust thresholds.

**The threshold encodes your quality contract.** An 80% gate says: "This system is acceptable if it handles 4 out of 5 well-understood inputs correctly." It tolerates minor regressions on genuinely hard cases while still catching systemic failures.

**When to adjust the threshold:**
- Raise it (e.g., 90%) when the system matures and the golden set becomes well-understood.
- Lower it (temporarily) when intentionally migrating to a new model that needs a tuning period.
- Set it per-category when some output classes are more important than others (e.g., safety-critical classifications must pass 100%).

**The threshold is a policy decision, not a technical one.** Involve product stakeholders when setting it.

---

## How to Update Golden Datasets When Behavior Intentionally Changes

Sometimes you *want* to change how the system behaves. A prompt rewrite might intentionally make neutral classifications more aggressive. A new model might shift confidence scores. These are not regressions — they are improvements.

### The update process

1. **Run the golden set against the new system.** Identify which cases now fail.
2. **For each failing case, decide: is this a regression or an improvement?**
   - If regression: fix the system, do not change the golden case.
   - If improvement: update the golden case's `expectedLabel` or `minConfidence` to reflect the new correct behavior.
3. **Get human sign-off.** A second engineer should review and approve every golden case change. Automated changes to golden datasets defeat their purpose.
4. **Commit the updated golden dataset** in the same pull request as the system change. The diff should be reviewable and auditable.
5. **Tag the dataset version** (e.g., `golden-v2.json`) if you want to retain history for comparison.

### What never to do

- Do not silently delete failing cases to make the pass rate go up.
- Do not lower the threshold without discussion.
- Do not auto-generate golden cases from the model's own outputs — this creates circular validation.

---

## Connection to A/B Testing New Model Versions

Golden datasets and A/B testing are complementary, not competing, strategies:

| Concern | Golden Datasets | A/B Testing |
|---------|----------------|-------------|
| When to use | Pre-deployment, in CI | Post-deployment, in production |
| What it measures | Known-correct cases | Real user behavior and outcomes |
| Speed | Instant (seconds) | Days to weeks |
| Coverage | Curated, limited | Full traffic distribution |
| Signal type | Deterministic pass/fail | Statistical significance |

**The typical workflow:**

1. A new model version is proposed.
2. Run the golden set against the new model in CI. If it passes the threshold, the model is a candidate for deployment.
3. Deploy the new model to a small traffic slice (e.g., 5%) using feature flags or a model gateway.
4. Monitor production metrics (user satisfaction, downstream conversion, error rates).
5. If production metrics are stable or improved, gradually roll out to 100%.
6. After full rollout, add any new failure patterns discovered in production back to the golden dataset.

This makes golden datasets the **fast gate** and A/B testing the **slow gate** in a two-layer quality system.

---

## Running the Tests

```bash
# From the qa/ root
npx playwright test --config=12-golden-datasets/playwright.config.ts

# Or from inside this folder
npx playwright test
```

The server starts automatically. No manual setup required.

## File Structure

```
12-golden-datasets/
├── demo/
│   └── server.js                  # Express classifier API on port 3012
├── tests/
│   ├── fixtures/
│   │   └── golden.json            # The curated golden dataset
│   └── golden.spec.ts             # All golden dataset tests
├── prompts/
│   └── spec.md                    # Plain-English specification
├── playwright.config.ts           # Playwright config with webServer
└── README.md                      # This file
```
