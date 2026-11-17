# Doneward

A local-first personal task board. Open a single board on this device, add cards within each column, and open any card to edit or delete it. Card drafts require explicit Save; dismissing changed drafts asks before discarding. Committed changes save automatically to IndexedDB. Column management and the remaining v1 features are separate slices.

## Development

Use Node.js 24 LTS (`nvm use`); the tooling requires at least Node.js 22.22.1.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For a production build, run `npm run build`, then `npm start`.

## Checks

```sh
npx playwright install chromium firefox webkit
npm test
npm run check
npm run build
```

Playwright exercises the browser UI with real IndexedDB in all three engines. Fixtures seed saved boards and inject failures only at the browser-storage boundary; tests do not import application internals. Tests build and start a production server on port 3100, independently of `next dev`.

### Formatting and commits

`npm ci` installs the Git hooks through Husky. Each commit autoformats staged files with Prettier and runs ESLint with safe autofixes on staged JavaScript/TypeScript. It then runs repository-wide ESLint (including warnings), typechecking, and the full browser test suite. Any failure blocks the commit. Install Playwright's browsers before your first commit using the command above.

Use `npm run format` to format the repository and `npm run check` for a read-only formatting, lint, and type check. Prettier owns formatting; ESLint checks code correctness, with conflicting formatting rules disabled. Generated files, browser reports, and npm's lockfile are excluded from Prettier.

Partially staged files are handled by lint-staged: unstaged changes are hidden during formatting and restored afterward. Review the staged diff after a hook fixes formatting. The first formatting commit establishes the baseline; subsequent feature work should avoid unrelated formatting changes.

The `Quality` GitHub Actions workflow independently checks formatting, lint, types, and the production build on pushes and pull requests. Browser tests remain local because the reviewed visual baselines are macOS-specific. To enforce checks before merging, configure a GitHub branch ruleset requiring `Format, lint, types, and build` and pull requests. Local hooks are a guardrail, not a security boundary: Git permits bypassing them.

Visual baselines under `tests/board.spec.ts-snapshots/` cover mixed-direction content in both themes at desktop and narrow widths. The checked-in baselines are for macOS. Review changes against `docs/design/board.md` before updating them with `npm test -- -g canvas --update-snapshots`; other platforms need their own reviewed baselines.

## Local storage

The browser owns the board; no server database or account is used. IndexedDB database `doneward` (version 1), store `boards`, key `current` contains `{ version: 1, columns: [{ id, name, cards: [{ id, title, description? }] }]`. Array order is board order. Column IDs are unique and each card ID occurs exactly once across the board. Empty saved boards retain at least one column.

Only an absent key triggers starter-board creation. Invalid or unreadable saved data displays an error without replacement; writes count as saved only after the transaction commits. Full recovery controls, backup export/import, multi-tab editing ownership, and offline application caching belong to later tickets. Clearing browser site data can remove the board.
