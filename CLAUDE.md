# Claude Guidance

@AGENTS.md

## Agent skills

### Issue tracker

Issues and specifications live in GitHub Issues. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Use the repository's canonical five-role triage vocabulary. See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

This is a single-context repository. See [`docs/agents/domain.md`](docs/agents/domain.md).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
