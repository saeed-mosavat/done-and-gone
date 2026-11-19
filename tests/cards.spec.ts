import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("creation drafts stay separate and confirmations support Escape and keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  const add = page
    .getByRole("region", { name: "Todo", exact: true })
    .getByRole("button", { name: "Add card", exact: true });
  await add.press("Enter");
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .press("Enter");
  await expect(add).toBeFocused();
  await add.press("Enter");
  const editor = page.getByRole("dialog", { name: "New card" });
  await editor.getByLabel("Title", { exact: true }).fill("Unsaved");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Discard unsaved edits?" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Discard unsaved edits?" })
  ).toHaveCount(0);
  await expect(editor.getByLabel("Title", { exact: true })).toBeFocused();
  await editor.getByRole("button", { name: "Save", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    editor.getByRole("button", { name: "Close", exact: true })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Discard changes" }).press("Enter");
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("saving and deleting return keyboard focus to the card or its column", async ({
  page,
}) => {
  await page.goto("/");
  const card = page
    .getByRole("article")
    .getByRole("button", { name: /^Edit / });
  await card.press("Enter");
  await page.getByLabel("Title", { exact: true }).fill("Focus card");
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(card).toBeFocused();
  await card.press("Enter");
  await page
    .getByRole("button", { name: "Delete card", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Delete permanently" }).press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(
    page
      .getByRole("region", { name: "Todo", exact: true })
      .getByRole("button", { name: "Add card", exact: true })
  ).toBeFocused();
});

test("failed card writes never report saved and leave the last saved board intact", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      request.addEventListener("success", () => this.transaction.abort());
      return request;
    };
  });
  await page
    .getByRole("article")
    .getByRole("button", { name: /^Edit / })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Not saved");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be saved"
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("article")).toContainText(
    "Welcome to Done & Gone"
  );
});

test("mixed-direction dialogs are accessible in both themes and narrow layouts", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("region", { name: "Todo", exact: true })
    .getByRole("button", { name: "Add card", exact: true })
    .press("Enter");
  const editor = page.getByRole("dialog", { name: "New card" });
  await editor
    .getByLabel("Title", { exact: true })
    .fill("بررسی https://example.com (42)");
  await editor
    .getByLabel("Description", { exact: true })
    .fill(
      "  نسخه جدید UI 42.\nEnglish https://example.com (7).\n\nپایان Doneward!"
    );
  await expect(editor.getByLabel("Title", { exact: true })).toHaveCSS(
    "direction",
    "rtl"
  );
  await expect(editor.getByLabel("Description", { exact: true })).toHaveCSS(
    "unicode-bidi",
    "plaintext"
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(editor).toHaveScreenshot(
        `editor-${width}-${colorScheme}.png`
      );
    }
  }
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Keep editing" }).press("Enter");
  await editor
    .getByRole("button", { name: "Save", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await page
    .getByRole("article")
    .first()
    .getByRole("button", { name: /^Edit / })
    .press("Enter");
  await page
    .getByRole("button", { name: "Delete card", exact: true })
    .press("Enter");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test.describe("touch cards", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("creation and editing work by touch", async ({ page }) => {
    await page.goto("/");
    const column = page.getByRole("region", { name: "Todo", exact: true });
    await column.getByRole("button", { name: "Add a card", exact: true }).tap();
    await page.getByLabel("Title", { exact: true }).fill("Touch card");
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
    await column.getByRole("article").last().tap();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Touch card"
    );
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("deletion names the card, cancels safely, and an emptied board stays empty", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("article")
    .getByRole("button", { name: /^Edit / })
    .click();
  await page.getByRole("button", { name: "Delete card", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Delete card?" });
  await expect(confirmation).toContainText("Welcome to Done & Gone");
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit card", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete card", exact: true }).click();
  await confirmation
    .getByRole("button", { name: "Delete permanently" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByLabel("0 cards", { exact: true })).toHaveCount(3);
});

test("card validation accepts exact limits and duplicate titles without truncating invalid input", async ({
  page,
}) => {
  await page.goto("/");
  const column = page.getByRole("region", { name: "Doing", exact: true });
  for (let copy = 0; copy < 2; copy++) {
    await column.getByRole("button", { name: "Add card", exact: true }).click();
    const editor = page.getByRole("dialog");
    const title = editor.getByLabel("Title", { exact: true });
    const description = editor.getByLabel("Description", { exact: true });
    for (const invalid of ["   ", "x".repeat(201)]) {
      await title.fill(invalid);
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      await expect(editor.getByRole("alert")).toContainText("Title");
      await expect(title).toHaveValue(invalid);
    }
    await title.fill("x".repeat(200));
    await description.fill("d".repeat(20001));
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor.getByRole("alert")).toContainText("Description");
    await description.fill("d".repeat(20000));
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
  }
  await page.reload();
  await expect(column.getByRole("heading", { level: 3 })).toHaveText([
    "x".repeat(200),
    "x".repeat(200),
  ]);
});

test("whole-card editing saves explicitly and every dismissal protects dirty drafts", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.getByRole("article");
  await card.click({ position: { x: 40, y: 75 } });
  const editor = page.getByRole("dialog", { name: "Edit card", exact: true });
  await editor.getByLabel("Title", { exact: true }).fill("Edited");
  for (const dismissal of ["Cancel", "Close", "Escape", "backdrop"]) {
    if (dismissal === "Escape") await page.keyboard.press("Escape");
    else if (dismissal === "backdrop") await page.mouse.click(5, 5);
    else
      await editor
        .getByRole("button", { name: dismissal, exact: true })
        .click();
    const confirmation = page.getByRole("dialog", {
      name: "Discard unsaved edits?",
    });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Keep editing" }).click();
    await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
      "Edited"
    );
  }
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(card).toContainText("Welcome to Done & Gone");
  await expect(card.getByRole("button", { name: /^Edit / })).toBeFocused();
  await card.getByRole("button", { name: /^Edit / }).press("Enter");
  await editor.getByLabel("Title", { exact: true }).fill("  Edited  ");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(card.getByRole("heading")).toHaveText("Edited");
});

test("both column-scoped entry points append cards and persist their order", async ({
  page,
}) => {
  await page.goto("/");
  const column = page.getByRole("region", { name: "Doing", exact: true });
  for (const entry of ["Add card", "Add a card"]) {
    await column.getByRole("button", { name: entry, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New card" });
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
    await dialog.getByLabel("Title", { exact: true }).fill(`  ${entry}  `);
    await dialog
      .getByLabel("Description", { exact: true })
      .fill("  Plain <b>text</b>\t\n\nپایان UI 42.  ");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Saved on this device");
  }
  await expect(column.getByRole("heading", { level: 3 })).toHaveText([
    "Add card",
    "Add a card",
  ]);
  await expect(column.getByLabel("2 cards", { exact: true })).toBeVisible();
  await page.reload();
  await expect(column.getByRole("heading", { level: 3 })).toHaveText([
    "Add card",
    "Add a card",
  ]);
  expect(
    await column.getByRole("article").first().locator("div").textContent()
  ).toBe("  Plain <b>text</b>\t\n\nپایان UI 42.  ");
  await column
    .getByRole("article")
    .first()
    .getByRole("button", { name: /^Edit / })
    .click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "  Plain <b>text</b>\t\n\nپایان UI 42.  "
  );
});
