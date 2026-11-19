import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedBoard } from "./storage-fixture";

const addColumn = (page: Page) =>
  page.getByRole("button", { name: "Add column", exact: true });
const saved = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Saved on this device" });

async function createColumn(page: Page, name: string) {
  await addColumn(page).press("Enter");
  await page.getByRole("textbox", { name: "Column name" }).fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(saved(page)).toHaveText("Saved on this device");
}

test("a waiting tab never seeds a missing board while another lock holder exists", async ({
  page,
  context,
}) => {
  // Hold ownership before application startup, without creating any saved board.
  await page.goto("/favicon.ico");
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      void navigator.locks.request("doneward-board-editor", async () => {
        resolve();
        await new Promise<void>(() => {});
      });
    });
  });
  const reader = await context.newPage();
  await reader.addInitScript(() => {
    IDBObjectStore.prototype.put = () => {
      throw new Error("A waiting tab must never write");
    };
  });
  await reader.goto("/");
  await expect(reader.getByRole("status")).toHaveText("Opening your board…");
  await reader.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("doneward", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const key = await new Promise<unknown>((resolve) => {
      const request = database
        .transaction("boards")
        .objectStore("boards")
        .getKey("current");
      request.onsuccess = () => resolve(request.result);
    });
    database.close();
    if (key !== undefined) throw new Error("Waiting tab initialized data");
  });
  await expect(reader.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(addColumn(reader)).toHaveCount(0);
});

test("unsupported coordination fails closed without writing a board", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "locks", { value: undefined });
    IDBObjectStore.prototype.put = () => {
      throw new Error("Unsupported browsers must not write");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Web Locks and BroadcastChannel"
  );
  await expect(addColumn(page)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("simultaneous first visits have one initializer and one editor, then queued handoffs", async ({
  context,
}) => {
  await context.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    let writes = 0;
    Object.defineProperty(window, "boardWrites", { get: () => writes });
    IDBObjectStore.prototype.put = function (...args) {
      writes++;
      return put.apply(this, args);
    };
  });
  const pages = await Promise.all([
    context.newPage(),
    context.newPage(),
    context.newPage(),
  ]);
  await Promise.all(pages.map((page) => page.goto("/")));
  for (const page of pages)
    await expect(page.getByRole("article")).toHaveCount(1);
  await expect
    .poll(async () =>
      Promise.all(pages.map((page) => addColumn(page).isEnabled()))
    )
    .toContain(true);
  const owners = await Promise.all(
    pages.map((page) => addColumn(page).isEnabled())
  );
  expect(owners.filter(Boolean)).toHaveLength(1);
  const writes = await Promise.all(
    pages.map((page) => page.evaluate(() => Reflect.get(window, "boardWrites")))
  );
  expect(writes.reduce((sum, count) => sum + count, 0)).toBe(1);
  const editor = pages[owners.indexOf(true)];
  const readers = pages.filter((page) => page !== editor);
  await createColumn(editor, "Latest saved");
  for (const reader of readers) {
    await expect(
      reader.getByRole("heading", { name: "Latest saved" })
    ).toBeVisible();
    await expect(addColumn(reader)).toBeDisabled();
    expect(
      await reader.evaluate(() => Reflect.get(window, "boardWrites"))
    ).toBe(0);
  }
  await editor.close();
  await expect
    .poll(
      async () =>
        (
          await Promise.all(readers.map((page) => addColumn(page).isEnabled()))
        ).filter(Boolean).length
    )
    .toBe(1);
  const next = (await addColumn(readers[0]).isEnabled())
    ? readers[0]
    : readers[1];
  const last = readers.find((page) => page !== next)!;
  await createColumn(next, "Second editor");
  await expect(
    last.getByRole("heading", { name: "Second editor" })
  ).toBeVisible();
  await next.goto("about:blank");
  await expect(addColumn(last)).toBeEnabled();
  await expect(last.getByRole("note")).toHaveCount(0);
  await last.reload();
  await expect(
    last.getByRole("heading", { name: "Second editor" })
  ).toBeVisible();
  await expect(addColumn(last)).toBeEnabled();
});

test("readers disable every mutation path but retain keyboard backups and themes", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(addColumn(page)).toBeEnabled();
  const reader = await context.newPage();
  await reader.goto("/");
  await expect(reader.getByRole("note")).toContainText("another tab");
  for (const button of await reader.locator(".board button").all())
    await expect(button).toBeDisabled();
  await reader
    .getByLabel("Column actions", { exact: true })
    .first()
    .press("Enter");
  for (const button of await reader
    .locator(".column-actions-panel")
    .first()
    .getByRole("button")
    .all())
    await expect(button).toBeDisabled();
  await reader
    .getByLabel("Column actions", { exact: true })
    .first()
    .press("Enter");
  await reader
    .getByRole("button", { name: "Backups", exact: true })
    .press("Enter");
  await expect(
    reader.getByLabel("Import backup", { exact: true })
  ).toBeDisabled();
  const download = reader.waitForEvent("download");
  await reader
    .getByRole("button", { name: "Export backup", exact: true })
    .press("Enter");
  await download;
  expect((await new AxeBuilder({ page: reader }).analyze()).violations).toEqual(
    []
  );
  await reader.keyboard.press("Escape");
  await expect(
    reader.getByRole("button", { name: "Backups", exact: true })
  ).toBeFocused();
  await reader.getByRole("button", { name: "Toggle theme" }).press("Enter");
  await expect(reader.getByRole("main")).toHaveCSS("color-scheme", "dark");
  expect((await new AxeBuilder({ page: reader }).analyze()).violations).toEqual(
    []
  );
  await reader.locator(".card").hover();
  await reader.mouse.down();
  await reader.mouse.move(600, 600, { steps: 10 });
  await reader.mouse.up();
  await expect(
    reader.getByRole("region", { name: "Delete drop zone" })
  ).toHaveCount(0);
  await expect(reader.getByRole("dialog")).toHaveCount(0);
});

test("only committed changes reach readers, including movement, deletion, and import", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(addColumn(page)).toBeEnabled();
  const reader = await context.newPage();
  await reader.goto("/");
  await expect(reader.getByRole("article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Edit Welcome to Done & Gone", exact: true })
    .press("Enter");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Saved title");
  await expect(reader.getByRole("article")).toContainText(
    "Welcome to Done & Gone"
  );
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(reader.getByRole("article")).toContainText("Saved title");
  await expect(saved(page)).toHaveText("Saved on this device");
  await page
    .getByRole("button", { name: "Edit Saved title", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Move card", exact: true }).click();
  await page.getByLabel("Column", { exact: true }).selectOption("doing");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(
    reader
      .getByRole("region", { name: "Doing", exact: true })
      .getByRole("article")
  ).toHaveCount(1);
  await expect(saved(page)).toHaveText("Saved on this device");
  await page
    .getByRole("button", { name: "Edit Saved title", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Delete card", exact: true })
    .press("Enter");
  await expect(reader.getByRole("article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .press("Enter");
  await expect(reader.getByRole("article")).toHaveCount(0);
  await expect(saved(page)).toHaveText("Saved on this device");
  await page
    .getByRole("button", { name: "Backups", exact: true })
    .press("Enter");
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        columns: [
          {
            id: "new",
            name: "Imported",
            cards: [{ id: "imported", title: "From backup" }],
          },
        ],
      })
    ),
  });
  await expect(reader.getByRole("article")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Replace board", exact: true })
    .press("Enter");
  await expect(reader.getByRole("heading", { level: 2 })).toHaveText([
    "Imported",
  ]);
  await expect(reader.getByRole("article")).toHaveCount(1);
  await page.close();
  await expect(addColumn(reader)).toBeEnabled();
  await createColumn(reader, "After import");
});

test("failed writes never notify readers or replace their saved snapshot", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(addColumn(page)).toBeEnabled();
  const reader = await context.newPage();
  await reader.goto("/");
  await expect(reader.getByRole("article")).toHaveCount(1);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await addColumn(page).press("Enter");
  await page.getByRole("textbox", { name: "Column name" }).fill("Not saved");
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be saved"
  );
  await expect(reader.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
  ]);
  await page.close();
  await expect(addColumn(reader)).toBeEnabled();
  await expect(reader.getByRole("heading", { level: 2 })).toHaveText([
    "Todo",
    "Doing",
    "Done",
  ]);
});

test.describe("read-only touch controls", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("touch cannot create or edit until automatic handoff", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(addColumn(page)).toBeEnabled();
    const reader = await context.newPage();
    await reader.goto("/");
    await expect(reader.getByRole("note")).toBeVisible();
    for (const target of [
      reader.getByRole("button", { name: "Add card", exact: true }).first(),
      reader.locator(".card"),
      reader.getByRole("button", { name: "Add a card", exact: true }).first(),
    ]) {
      const box = (await target.boundingBox())!;
      await reader.touchscreen.tap(
        box.x + box.width / 2,
        box.y + box.height / 2
      );
      await expect(reader.getByRole("dialog")).toHaveCount(0);
    }
    await reader.getByLabel("Column actions", { exact: true }).first().tap();
    await expect(
      reader.getByRole("button", { name: "Rename column", exact: true })
    ).toBeDisabled();
    await reader.getByLabel("Column actions", { exact: true }).first().tap();
    await page.close();
    await expect(addColumn(reader)).toBeEnabled();
    await reader
      .getByRole("button", { name: "Add card", exact: true })
      .first()
      .tap();
    await expect(
      reader.getByRole("dialog", { name: "New card", exact: true })
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page: reader }).analyze()).violations
    ).toEqual([]);
  });
});

for (const theme of ["light", "dark"] as const) {
  for (const narrow of [false, true]) {
    test(`read-only ${theme} ${narrow ? "narrow" : "desktop"} preserves the approved board`, async ({
      page,
      context,
    }) => {
      await seedBoard(page, {
        version: 1,
        columns: [
          {
            id: "one",
            name: "بررسی Doneward 42",
            cards: [
              {
                id: "card",
                title: "نسخه UI 42",
                description:
                  "فارسی UI.\nEnglish https://example.com (7).\nپایان!",
              },
            ],
          },
          { id: "two", name: "Queue صف 3", cards: [] },
          { id: "three", name: "Done", cards: [] },
        ],
      });
      const reader = await context.newPage();
      await reader.emulateMedia({ colorScheme: theme });
      if (narrow) await reader.setViewportSize({ width: 390, height: 844 });
      await reader.goto("/");
      await expect(reader.getByRole("note")).toBeVisible();
      await expect(reader.getByRole("heading", { level: 3 })).toHaveCSS(
        "direction",
        "rtl"
      );
      await expect(reader.locator(".card p").nth(1)).toHaveCSS(
        "direction",
        "ltr"
      );
      await expect(reader.locator(".card-count")).toHaveCount(0);
      await expect(reader.getByRole("article")).toHaveCount(1);
      expect(
        (await new AxeBuilder({ page: reader }).analyze()).violations
      ).toEqual([]);
      await expect(reader).toHaveScreenshot(
        `read-only-${theme}-${narrow ? "narrow" : "desktop"}.png`
      );
      if (narrow) {
        await reader
          .getByRole("region", { name: "Board", exact: true })
          .focus();
        await reader.keyboard.press("ArrowRight");
        await expect
          .poll(() =>
            reader.locator(".board").evaluate((board) => board.scrollLeft)
          )
          .toBeGreaterThan(0);
      }
    });
  }
}
