import { expect, test } from "@playwright/test";

test("desktop editing separates movement and keeps unsaved changes protected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("article").click();
  const editor = page.getByRole("dialog", { name: "Edit card", exact: true });
  await expect(editor.getByLabel("Column", { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel("Position", { exact: true })).toHaveCount(0);
  const move = editor.getByRole("button", { name: "Move card", exact: true });
  await move.press("Enter");
  const movement = page.getByRole("dialog", { name: "Move card", exact: true });
  await expect(movement.getByLabel("Column", { exact: true })).toBeFocused();
  await movement
    .getByLabel("Column", { exact: true })
    .selectOption({ label: "2. Doing" });
  await page.keyboard.press("Escape");
  await expect(movement).toHaveCount(0);
  await expect(move).toBeFocused();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Discard unsaved edits?" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Doing", exact: true })
      .getByRole("article")
  ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("article").click();
  await expect(editor.getByLabel("Column", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("Position", { exact: true })).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Move card", exact: true })
  ).toHaveCount(0);
});

test("column titles are prominent at desktop and narrow widths", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(
      page.getByRole("heading", { name: "Todo", exact: true })
    ).toHaveCSS("font-size", "18px");
    await expect(
      page
        .getByRole("region", { name: "Todo", exact: true })
        .getByRole("button", { name: "Add card", exact: true })
    ).toBeVisible();
  }
});

test("a chosen theme survives refresh and is shared with another tab", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const app = page.getByRole("main");
  await expect(app).toHaveCSS("color-scheme", "dark");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(app).toHaveCSS("color-scheme", "light");
  await page.reload();
  await expect(app).toHaveCSS("color-scheme", "light");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByRole("main")).toHaveCSS("color-scheme", "light");
  await other.getByRole("button", { name: "Toggle theme" }).click();
  await expect(app).toHaveCSS("color-scheme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(app).toHaveCSS("color-scheme", "dark");
});

test("unavailable preference storage does not break the theme toggle", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "light");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.getByRole("main")).toHaveCSS("color-scheme", "dark");
});

test("saving announcements do not occupy a visible footer", async ({
  page,
}) => {
  await page.goto("/");
  const status = page.getByRole("status");
  await expect(status).toHaveText("Saved on this device");
  const bounds = (await status.boundingBox())!;
  expect(bounds.width).toBeLessThanOrEqual(1);
  expect(bounds.height).toBeLessThanOrEqual(1);
});

test("the compact header keeps the board within the top 90px", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    const column = page.getByRole("region", { name: "Todo", exact: true });
    await expect(column).toBeVisible();
    const bounds = (await column.boundingBox())!;
    expect(bounds.y).toBeLessThanOrEqual(90);
    expect(bounds.x).toBeLessThanOrEqual(20);
    expect(bounds.height).toBeGreaterThan(800);
    const header = page.locator("header");
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(64);
  }
});
