# Done & Gone

A local-first personal task board. Open a single board on this device, add cards within each column, and open any card to edit, move, reorder, or delete it. Card drafts require explicit Save; dismissing changed drafts asks before discarding. Drag cards directly to move or reorder them, use column handles to reorder columns, or use the card editor and column menus without dragging. Dragging a card to the red delete zone asks for confirmation; cancellation preserves its original position. On touch screens, hold a card or a column handle to start dragging; ordinary swipes still scroll the board. Add columns on the right; use each column's contextual actions to rename it or confirm deletion, choosing whether to transfer or delete its cards. At least one column always remains. Committed changes save automatically to IndexedDB. Export complete backups or replace the board by importing a validated backup through the header's Backups control.

## Development

Use Node.js 24 LTS (`nvm use`); the tooling requires at least Node.js 22.22.1.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For a production build, run `npm run build`, then `npm start`.

The theme follows the system until explicitly toggled. Your choice is stored on this browser and reused across refreshes and tabs. If preference storage is unavailable, toggling still works for the current visit.

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

Visual baselines under `tests/*-snapshots/` cover the board, card/column dialogs, and mixed-direction content in both themes at desktop and narrow widths. The checked-in baselines are for macOS. Review changes against `docs/design/board.md` before updating the relevant test's snapshots with `--update-snapshots`; other platforms need their own reviewed baselines.

## Local storage

Use **Backups** in the header to download a complete version 1 JSON backup or import one. Import validates the entire file before offering replacement, never merges boards, and lets you export the current board before confirming. Names and titles are trimmed; description whitespace and line breaks are preserved. Keep backups outside the browser: clearing site data can remove the board.

The browser owns the board; no server database or account is used. IndexedDB database `doneward` (version 1), store `boards`, key `current` contains `{ version: 1, columns: [{ id, name, cards: [{ id, title, description? }] }]`. Array order is board order. Column IDs are unique and each card ID occurs exactly once across the board. Empty saved boards retain at least one column.

Only an absent key triggers starter-board creation. Invalid or unreadable saved data displays an error without replacement; writes count as saved only after the transaction commits. Full recovery controls belong to a later ticket. Clearing browser site data can remove the board.

## Offline use and updates

In production over HTTPS (or localhost), a service worker prepares the complete application shell and immutable assets after the first online visit. Once preparation finishes, the board can be closed and reopened offline; all delivered local board features still work, including saves and backups. Preparation is atomic: a failed download does not replace the previously prepared application. Browser site-data clearing or storage eviction can remove offline availability, so keep exported backups outside the browser.

New deployments prepare in the background on visits, reconnection, or returning to the tab. **Update available** offers **Reload to update** without automatically refreshing any tab. Card and column dialogs also offer the action, with **Keep editing** or explicit discard confirmation; save drafts first to retain them. Applying an update preserves the saved board. Other tabs keep their current view and drafts until they choose to reload.

The `/sw.js` route embeds the production build ID and all files under `.next/static`; deployments must serve `.next/BUILD_ID` and `.next/static` alongside the Next.js server. Shells and assets are versioned together, and previous caches are retained so older open tabs can still load their chunks. Development does not register a worker; use a separate origin/port from production to avoid an installed production worker controlling development pages.

## Multiple tabs

An exclusive Web Lock allows one tab to edit per browser profile and origin. Other tabs display live, read-only saved boards with disabled mutation controls; themes and backup export remain available. BroadcastChannel announces successful saves, never unsaved drafts or failed writes. Closing or leaving the editor automatically hands editing access to a waiting tab, which reloads the latest saved board before enabling changes. Browsers must support Web Locks and BroadcastChannel; unsupported browsers show an explanation rather than risk concurrent writes. This does not coordinate other browsers or devices. Close older application tabs when upgrading from a version without editing coordination.
