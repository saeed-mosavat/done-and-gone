import { expect, test } from "@playwright/test";
import { seedBoard } from "./storage-fixture";
import AxeBuilder from "@axe-core/playwright";

test("the loading state is accessible while storage is opening", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      const request = original.apply(this, args);
      request.addEventListener("success", (event) => {
        event.stopImmediatePropagation();
        request.result.close();
      });
      return request;
    };
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Opening your board…");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Toggle theme" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "dark");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("a first visit saves the starter board and keeps it across reloads", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
  ]);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText(
    "Welcome to Done & Gone"
  );
  await expect(page.getByRole("status")).toHaveText("Saved on this device");

  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
  ]);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText(
    "Welcome to Done & Gone"
  );
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
});

test("an intentionally empty saved board is not reseeded", async ({ page }) => {
  await seedBoard(page, {
    version: 1,
    columns: [{ id: "only", name: "My column", cards: [] }],
  });
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "My column",
  ]);
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "My column",
  ]);
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("invalid saved data is not rendered or replaced with a starter board", async ({
  page,
}) => {
  await seedBoard(page, { version: 1, columns: [] });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be opened"
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).press("Enter");
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "dark");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Existing data has not been replaced"
  );
});

const invalidBoards: Record<string, unknown> = {
  "unsupported version": {
    version: 2,
    columns: [{ id: "c", name: "Column", cards: [] }],
  },
  "null data": null,
  "undefined stored value": undefined,
  "missing cards": { version: 1, columns: [{ id: "c", name: "Column" }] },
  "blank name": { version: 1, columns: [{ id: "c", name: "  ", cards: [] }] },
  "overlong name": {
    version: 1,
    columns: [{ id: "c", name: "x".repeat(81), cards: [] }],
  },
  "blank title": {
    version: 1,
    columns: [{ id: "c", name: "Column", cards: [{ id: "a", title: " " }] }],
  },
  "overlong title": {
    version: 1,
    columns: [
      { id: "c", name: "Column", cards: [{ id: "a", title: "x".repeat(201) }] },
    ],
  },
  "invalid description": {
    version: 1,
    columns: [
      {
        id: "c",
        name: "Column",
        cards: [{ id: "a", title: "Card", description: 42 }],
      },
    ],
  },
  "overlong description": {
    version: 1,
    columns: [
      {
        id: "c",
        name: "Column",
        cards: [{ id: "a", title: "Card", description: "x".repeat(20001) }],
      },
    ],
  },
  "duplicate column identity": {
    version: 1,
    columns: [
      { id: "c", name: "One", cards: [] },
      { id: "c", name: "Two", cards: [] },
    ],
  },
  "duplicate card membership": {
    version: 1,
    columns: [
      { id: "c", name: "One", cards: [{ id: "a", title: "Card" }] },
      { id: "d", name: "Two", cards: [{ id: "a", title: "Card" }] },
    ],
  },
};

for (const [reason, board] of Object.entries(invalidBoards)) {
  test(`unreadable board: ${reason} preserves the unresolved failure across reloads`, async ({
    page,
  }) => {
    await seedBoard(page, board);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "could not be opened"
    );
    await expect(page.getByRole("article")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "could not be opened"
    );
  });
}

test("a saved board retains exact order and mixed-direction plain text", async ({
  page,
}) => {
  await seedBoard(page, {
    version: 1,
    columns: [
      {
        id: "review",
        name: "بررسی Doneward 42",
        cards: [
          {
            id: "a",
            title: "بررسی https://example.com (42)",
            description:
              "  نسخه جدید UI 42.\nEnglish https://example.com (7).\n\nپایان Doneward!",
          },
          {
            id: "b",
            title: "Next قدم 2",
            description: "<strong>Plain text</strong>",
          },
        ],
      },
      { id: "queue", name: "Queue صف 3", cards: [] },
    ],
  });
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "بررسی Doneward 42",
    "Queue صف 3",
  ]);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "بررسی https://example.com (42)",
    "Next قدم 2",
  ]);
  await expect(page.getByRole("article").first()).toContainText(
    "  نسخه جدید UI 42.\nEnglish https://example.com (7).\n\nپایان Doneward!",
    { useInnerText: false }
  );
  await expect(page.getByRole("article").last()).toContainText(
    "<strong>Plain text</strong>"
  );
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveAttribute(
    "dir",
    "auto"
  );
  await expect(page.getByRole("heading", { level: 3 }).first()).toHaveCSS(
    "direction",
    "rtl"
  );
  await expect(page.getByRole("heading", { level: 3 }).last()).toHaveCSS(
    "direction",
    "ltr"
  );
  const paragraphs = page.getByRole("article").first().locator("p");
  await expect(paragraphs.nth(0)).toHaveCSS("direction", "rtl");
  await expect(paragraphs.nth(1)).toHaveCSS("direction", "ltr");
  await expect(paragraphs.nth(3)).toHaveCSS("direction", "rtl");
  await expect(paragraphs.nth(0)).toHaveCSS("white-space", "pre-wrap");
  await page.reload();
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "بررسی https://example.com (42)",
    "Next قدم 2",
  ]);
});

test("the board follows system theme and a keyboard toggle overrides it", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "dark");
  await expect(page.getByRole("main")).toHaveCSS(
    "background-color",
    "rgb(16, 24, 39)"
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Backups", exact: true })
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Toggle theme" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "light");
  await expect(page.getByRole("main")).toHaveCSS(
    "background-color",
    "rgb(245, 248, 252)"
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).press("Space");
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "dark");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the blue board-first canvas keeps columns side by side on desktop and narrow screens", async ({
  page,
}) => {
  await seedBoard(page, {
    version: 1,
    columns: [
      {
        id: "a",
        name: "بررسی Doneward 42",
        cards: [
          {
            id: "1",
            title: "بررسی https://example.com (42)",
            description:
              "  نسخه جدید UI 42.\nEnglish https://example.com (7).\n\nپایان Doneward!",
          },
          {
            id: "2",
            title: "Next قدم 2",
            description: "Plain text, no special status.",
          },
        ],
      },
      {
        id: "b",
        name: "Queue صف 3",
        cards: [
          {
            id: "3",
            title: "Read https://example.com — 123",
            description: "English first.\nمتن فارسی with English.",
          },
        ],
      },
      { id: "c", name: "Done", cards: [] },
    ],
  });
  const columns = page.getByRole("region");
  const board = page.getByRole("region", { name: "Board", exact: true });
  await expect(board).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Done & Gone"
  );
  await expect(page.getByLabel("2 cards", { exact: true })).toHaveText("2");
  await expect(page.getByLabel("1 cards", { exact: true })).toHaveText("1");
  await expect(page.getByLabel("0 cards", { exact: true })).toHaveText("0");
  await expect(
    page.getByRole("button", { name: "Add card", exact: true })
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Add a card", exact: true })
  ).toHaveCount(3);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    const first = await columns
      .filter({
        has: page.getByRole("heading", {
          name: "بررسی Doneward 42",
          exact: true,
        }),
      })
      .last()
      .boundingBox();
    const second = await page
      .getByRole("region", { name: "Queue صف 3", exact: true })
      .boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.x).toBeGreaterThan(first!.x);
    expect(second!.y).toBe(first!.y);
    if (width === 390) {
      expect(
        await board.evaluate(
          (element) => element.scrollWidth > element.clientWidth
        )
      ).toBe(true);
      await board.focus();
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => board.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
      await board.evaluate((element) => {
        element.scrollLeft = 0;
      });
      await board.evaluate((element) => (element as HTMLElement).blur());
    }
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(page.getByRole("main")).toHaveScreenshot(
        `board-${width}-${colorScheme}.png`,
        {
          animations: "disabled",
        }
      );
    }
  }
});

test("the starter board matches the approved direction in both themes and narrow layouts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Done & Gone");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Done & Gone"
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
  ]);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByLabel("1 cards", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("0 cards", { exact: true })).toHaveCount(2);
  const board = page.getByRole("region", { name: "Board", exact: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    if (width === 390) {
      expect(
        await board.evaluate(
          (element) => element.scrollWidth > element.clientWidth
        )
      ).toBe(true);
    }
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      const logo = page.locator(`.brand-${colorScheme}`);
      await expect(logo).toBeVisible();
      await expect(logo).toHaveJSProperty("complete", true);
      expect(
        await logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)
      ).toBeGreaterThan(0);
      await expect(page.getByRole("main")).toHaveScreenshot(
        `starter-${width}-${colorScheme}.png`,
        {
          animations: "disabled",
        }
      );
    }
  }
});

test("a failed storage read never replaces an existing saved board", async ({
  page,
}) => {
  await seedBoard(page, {
    version: 1,
    columns: [
      {
        id: "safe",
        name: "Keep my board",
        cards: [{ id: "safe-card", title: "Still here" }],
      },
    ],
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("fail-read")) {
      IDBObjectStore.prototype.get = function () {
        throw new DOMException("Storage unavailable", "UnknownError");
      };
    }
  });
  await page.evaluate(() => sessionStorage.setItem("fail-read", "yes"));
  await page.reload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be opened"
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => sessionStorage.removeItem("fail-read"));
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Keep my board",
  ]);
  await expect(page.getByRole("article")).toContainText("Still here");
});

test.describe("touch controls", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("the theme control works by touch on a narrow board", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await page.getByRole("button", { name: "Toggle theme" }).tap();
    await expect(page.getByRole("main")).toHaveCSS("color-scheme", "dark");
    await page.getByRole("button", { name: "Toggle theme" }).tap();
    await expect(page.getByRole("main")).toHaveCSS("color-scheme", "light");
  });
});

test("a transaction aborted after its write request succeeds is never reported as saved", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("allow-write")) return;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      request.addEventListener("success", () => this.transaction.abort());
      return request;
    };
  });
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be saved"
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).press("Enter");
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "dark");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => sessionStorage.setItem("allow-write", "yes"));
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
});
