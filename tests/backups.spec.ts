import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { seedBoard } from "./storage-fixture";
import AxeBuilder from "@axe-core/playwright";

const original = {
  version: 1,
  columns: [
    {
      id: "review",
      name: "بررسی https://example.com (42)",
      cards: [
        {
          id: "second",
          title: "نسخه UI 42",
          description:
            "  فارسی UI.\nEnglish https://example.com (7).\n\nپایان!  ",
        },
        { id: "first", title: "Next قدم 2", description: "<b>Plain text</b>" },
      ],
    },
    { id: "queue", name: "Queue صف 3", cards: [] },
  ],
};

async function exportFile(page: Page) {
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.json$/);
  return JSON.parse(await readFile((await file.path())!, "utf8"));
}

async function upload(page: Page, contents: unknown) {
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(contents)),
  });
}

test("downloads a complete versioned backup in board order without changing text", async ({
  page,
}) => {
  await seedBoard(page, original);
  await page
    .getByRole("button", { name: "Backups", exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Board backups",
    exact: true,
  });
  await expect(dialog).toContainText(
    "Clearing browser site data can remove your board"
  );
  expect(await exportFile(page)).toEqual(original);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Backups", exact: true })
  ).toBeFocused();
});

test("import offers export before replacement, cancellation, and a persisted full round trip", async ({
  page,
}) => {
  await seedBoard(page, original);
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  const backup = await exportFile(page);
  const replacement = {
    version: 1,
    columns: [{ id: "empty", name: "Intentionally empty", cards: [] }],
  };
  await upload(page, replacement);
  const confirmation = page.getByRole("dialog", {
    name: "Replace board?",
    exact: true,
  });
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true })
  ).toBeFocused();
  expect(await exportFile(page)).toEqual(original);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Import backup", { exact: true })).toBeFocused();
  await upload(page, replacement);
  await confirmation
    .getByRole("button", { name: "Replace board", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Intentionally empty",
  ]);
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  await upload(page, backup);
  await confirmation
    .getByRole("button", { name: "Replace board", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(
    original.columns.map((column) => column.name)
  );
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "نسخه UI 42",
    "Next قدم 2",
  ]);
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  expect(await exportFile(page)).toEqual(original);
});

test("rejects the entire invalid file without changing current or saved data", async ({
  page,
}) => {
  await seedBoard(page, original);
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  const invalid = [
    null,
    [],
    {},
    { ...original, version: 2 },
    { version: 1, columns: [] },
    { version: 1, columns: [{ id: "a", name: " ", cards: [] }] },
    { version: 1, columns: [{ id: "a", name: "x".repeat(81), cards: [] }] },
    { version: 1, columns: [{ id: "", name: "Name", cards: [] }] },
    { version: 1, columns: [{ id: "a", name: "Name" }] },
    { ...original, columns: [original.columns[0], original.columns[0]] },
    ...[
      { id: "bad", title: " " },
      { id: "bad", title: "x".repeat(201) },
      { id: "bad", title: "Valid", description: "x".repeat(20001) },
      { id: "bad", title: "Valid", description: null },
      { id: "bad", description: "Missing title" },
      { id: "", title: "Missing ID" },
      original.columns[0].cards[0],
    ].map((card) => ({
      ...original,
      columns: [
        ...original.columns,
        { id: "bad-column", name: "Bad", cards: [card] },
      ],
    })),
    {
      ...original,
      columns: [
        {
          ...original.columns[0],
          cards: [original.columns[0].cards[0], original.columns[0].cards[0]],
        },
      ],
    },
  ];
  for (const value of invalid) {
    await upload(page, value);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "not a valid version 1 board backup"
    );
    await expect(
      page.getByRole("dialog", { name: "Replace board?", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 3, includeHidden: true })
    ).toHaveText(["نسخه UI 42", "Next قدم 2"]);
  }
  for (const text of ['{"version":1,', JSON.stringify(original) + "\nfalse"]) {
    await page.getByLabel("Import backup", { exact: true }).setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "not a valid version 1 board backup"
    );
    await expect(
      page.getByRole("heading", { level: 3, includeHidden: true })
    ).toHaveText(["نسخه UI 42", "Next قدم 2"]);
  }
  await page.reload();
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  expect(await exportFile(page)).toEqual(original);
});

test("trims names and titles, accepts exact limits and duplicates, and preserves description whitespace", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  const name = "ن".repeat(80);
  const title = "T".repeat(200);
  const description = " \n" + "d".repeat(19996) + "\n ";
  const columns = ["one", "two"].map((id) => ({
    id,
    name: `  ${name}  `,
    cards: [{ id: `card-${id}`, title: `  ${title}  `, description }],
  }));
  await upload(page, { version: 1, columns });
  await page
    .getByRole("button", { name: "Replace board", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(
    page.getByRole("button", { name: "Backups", exact: true })
  ).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  expect(await exportFile(page)).toEqual({
    version: 1,
    columns: columns.map((column) => ({
      ...column,
      name,
      cards: column.cards.map((card) => ({ ...card, title })),
    })),
  });
});

test("an aborted import write never claims saved and leaves the previous saved board intact", async ({
  page,
}) => {
  await seedBoard(page, original);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const result = put.apply(this, args);
      this.transaction.abort();
      return result;
    };
  });
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  await upload(page, {
    version: 1,
    columns: [{ id: "new", name: "Replacement", cards: [] }],
  });
  await page
    .getByRole("button", { name: "Replace board", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be saved"
  );
  await expect(
    page.getByText("Saved on this device", { exact: true })
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  expect(await exportFile(page)).toEqual(original);
});

test("backup controls, validation, confirmation, and imported mixed text support keyboard, both themes and narrow layouts", async ({
  page,
}) => {
  await seedBoard(page, original);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page
        .getByRole("button", { name: "Backups", exact: true })
        .press("Enter");
      const dialog = page.getByRole("dialog", {
        name: "Board backups",
        exact: true,
      });
      await expect(
        page.getByRole("button", { name: "Close backups" })
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(
        page.getByRole("button", { name: "Export backup", exact: true })
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Close backups" })
      ).toBeFocused();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(dialog).toHaveScreenshot(
        `backups-${width}-${colorScheme}.png`
      );
      await upload(page, {});
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(dialog).toHaveScreenshot(
        `invalid-backup-${width}-${colorScheme}.png`
      );
      await upload(page, original);
      const confirmation = page.getByRole("dialog", {
        name: "Replace board?",
        exact: true,
      });
      await expect(
        confirmation.getByRole("button", { name: "Cancel", exact: true })
      ).toBeFocused();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(confirmation).toHaveScreenshot(
        `replace-board-${width}-${colorScheme}.png`
      );
      await page.keyboard.press("Shift+Tab");
      await expect(
        confirmation.getByRole("button", { name: "Export backup", exact: true })
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(
        confirmation.getByRole("button", { name: "Replace board", exact: true })
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toHaveText("Saved on this device");
      await expect(
        page.getByRole("heading", { level: 2 }).first()
      ).toHaveAttribute("dir", "auto");
      await expect(
        page.getByRole("article").first().locator("p").first()
      ).toHaveCSS("direction", "rtl");
      await expect(
        page.getByRole("article").first().locator("p").nth(1)
      ).toHaveCSS("direction", "ltr");
      await expect(page.getByRole("article").first()).toContainText(
        original.columns[0].cards[0].description!
      );
      await expect(page.getByRole("main")).toHaveScreenshot(
        `imported-board-${width}-${colorScheme}.png`
      );
    }
  }
});

test.describe("touch backups", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("touch opens backups, exports before replacement, cancels safely, and confirms an import", async ({
    page,
  }) => {
    await seedBoard(page, original);
    await page.getByRole("button", { name: "Backups", exact: true }).tap();
    const replacement = {
      version: 1,
      columns: [{ id: "empty", name: "صف Queue 42", cards: [] }],
    };
    // File selection is supplied at the browser's upload boundary.
    await upload(page, replacement);
    const confirmation = page.getByRole("dialog", {
      name: "Replace board?",
      exact: true,
    });
    const downloaded = page.waitForEvent("download");
    await confirmation
      .getByRole("button", { name: "Export backup", exact: true })
      .tap();
    const file = await downloaded;
    expect(JSON.parse(await readFile((await file.path())!, "utf8"))).toEqual(
      original
    );
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .tap();
    await page.getByRole("button", { name: "Close backups" }).tap();
    await expect(page.getByRole("article")).toHaveCount(2);
    await page.getByRole("button", { name: "Backups", exact: true }).tap();
    await upload(page, replacement);
    await confirmation
      .getByRole("button", { name: "Replace board", exact: true })
      .tap();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.reload();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "صف Queue 42",
    ]);
    await expect(page.getByRole("article")).toHaveCount(0);
  });
});
