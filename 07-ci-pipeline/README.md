# Tutorial 07 — CI Pipeline

## What You Will Learn
- What Continuous Integration (CI) is and why it matters
- How GitHub Actions works: triggers, jobs, steps
- How to read a failing CI run and find the failed test
- How to download and view the Playwright HTML report from a CI artifact

## What is CI?

CI (Continuous Integration) runs your tests automatically on every push or pull request.
You never merge broken code — the pipeline catches it first.

Without CI: Developer pushes code, breaks something, nobody notices until production.
With CI: Push → pipeline runs → if tests fail, the PR is blocked automatically.

## How GitHub Actions Works

```
Trigger (push/PR)
  └── Job: test
        ├── Step: checkout code
        ├── Step: install Node.js
        ├── Step: npm ci
        ├── Step: install Playwright browsers
        ├── Step: run tests
        └── Step: upload HTML report as artifact
```

## Reading a Failed CI Run
1. Click the red ✗ on the commit or PR
2. Open the failing job
3. Expand the failing step to see which test failed and why
4. Download the artifact for the full Playwright HTML report

## The Workflow File
See `.github/workflows/qa.yml` at the repo root.
It runs Tutorial 01–04 tests on every push to main or pull request.

## How to Trigger It
```bash
git push origin main
```
Then open your repo on GitHub → Actions tab → watch it run.
