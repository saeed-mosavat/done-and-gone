## Agent skills

### Issue tracker
Issues and specs live in GitHub Issues. Before reading or publishing tickets, see `docs/agents/issue-tracker.md`.

### Triage labels
Before triaging issues, see `docs/agents/triage-labels.md` for the five default labels.

### Domain docs
Single-context layout. Before exploring code or proposing domain changes, see `docs/agents/domain.md`.

### Approved board design
Before planning tickets, implementing board UI, or writing UI tests, read `docs/design/board.md`. Carry its relevant requirements into ticket acceptance criteria and tests. Treat the archived prototype as a visual reference, not production code.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
