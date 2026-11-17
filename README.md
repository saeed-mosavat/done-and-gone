# Doneward

A local-first personal task board. This foundation implements [ticket #2](https://github.com/saeed-mosavat/doneward/issues/2): opening, validating, saving, and displaying a single board on this device. Card editing and the remaining v1 features are separate slices.

## Development

Use Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For a production build, run `npm run build`, then `npm start`.

## Checks

```sh
npx playwright install chromium firefox webkit
npm test
npm run typecheck
npm run lint
npm run build
```

Playwright exercises the browser UI with real IndexedDB in all three engines. Fixtures seed saved boards and inject failures only at the browser-storage boundary; tests do not import application internals. Tests start their own server on port 3100.

Visual baselines under `tests/board.spec.ts-snapshots/` cover mixed-direction content in both themes at desktop and narrow widths. The checked-in baselines are for macOS. Review changes against `docs/design/board.md` before updating them with `npm test -- -g canvas --update-snapshots`; other platforms need their own reviewed baselines.

## Local storage

The browser owns the board; no server database or account is used. IndexedDB database `doneward` (version 1), store `boards`, key `current` contains `{ version: 1, columns: [{ id, name, cards: [{ id, title, description? }] }]`. Array order is board order. Column IDs are unique and each card ID occurs exactly once across the board. Empty saved boards retain at least one column.

Only an absent key triggers starter-board creation. Invalid or unreadable saved data displays an error without replacement; writes count as saved only after the transaction commits. Full recovery controls, backup export/import, multi-tab editing ownership, and offline application caching belong to later tickets. Clearing browser site data can remove the board.
