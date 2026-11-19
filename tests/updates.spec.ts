import {
  test,
  expect,
  prepareOffline,
  checkForUpdate,
} from "./deployment-fixture";
import AxeBuilder from "@axe-core/playwright";

test("a real prepared update waits, protects a draft, and reloads only on request", async ({
  page,
  deployment,
}) => {
  await page.goto(deployment.url);
  await prepareOffline(page);
  await page.getByRole("article").click();
  await page.getByLabel("Title", { exact: true }).fill("یادداشت Draft 123");
  await page.getByLabel("Description").fill("فارسی English\nEnglish فارسی");
  deployment.publish();
  await checkForUpdate(page);
  const editor = page.getByRole("dialog", { name: "Edit card", exact: true });
  await expect(
    editor.getByText("Update available", { exact: true })
  ).toBeVisible();
  await expect(page).toHaveTitle("Doneward revision 1");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "یادداشت Draft 123"
  );
  await page
    .getByLabel("Description")
    .fill("فارسی English\nEnglish فارسی\nContinued editing");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await editor.getByRole("button", { name: "Reload to update" }).press("Enter");
  const confirmation = page.getByRole("dialog", {
    name: "Discard edits and update?",
  });
  await expect(
    confirmation.getByRole("button", { name: "Keep editing" })
  ).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(
    editor.getByRole("button", { name: "Reload to update" })
  ).toBeFocused();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "یادداشت Draft 123"
  );
  await editor
    .getByRole("button", { name: "Save", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "Reload to update" }).press("Enter");
  await expect(page).toHaveTitle("Doneward revision 2");
  await expect(page.getByRole("article")).toContainText("یادداشت Draft 123");
  await expect(page.getByRole("article")).toContainText("فارسی English");
  await expect(page.getByText("Update available", { exact: true })).toHaveCount(
    0
  );
});

test("discarding a card draft to update preserves saved content and board order", async ({
  page,
  deployment,
}) => {
  await page.goto(deployment.url);
  await prepareOffline(page);
  await page
    .getByRole("button", { name: "Add a card", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Saved second");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.getByRole("article").last().click();
  await page.getByLabel("Title", { exact: true }).fill("Discard this draft");
  deployment.publish();
  await checkForUpdate(page);
  await page.getByRole("button", { name: "Reload to update" }).press("Enter");
  await page.getByRole("button", { name: "Discard and reload" }).press("Enter");
  await expect(page).toHaveTitle("Doneward revision 2");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("article").first()).toContainText(
    "Welcome to Doneward"
  );
  await expect(page.getByRole("article").last()).toHaveText("Saved second");
  await page.reload();
  await expect(page.getByRole("article").last()).toHaveText("Saved second");
});

test("an update applied in another tab never reloads the editor or loses its draft", async ({
  page,
  context,
  deployment,
}) => {
  await page.goto(deployment.url);
  await prepareOffline(page);
  await page.getByRole("article").click();
  await page.getByLabel("Title", { exact: true }).fill("Still editing");
  const reader = await context.newPage();
  await reader.goto(deployment.url);
  await expect(reader.getByRole("note")).toContainText("Read-only");
  deployment.publish();
  await checkForUpdate(reader);
  await reader.getByRole("button", { name: "Reload to update" }).click();
  await expect(reader).toHaveTitle("Doneward revision 2");
  await expect(page).toHaveTitle("Doneward revision 1");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Still editing"
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "Reload to update" }).click();
  await expect(page).toHaveTitle("Doneward revision 2");
  await expect(page.getByRole("article").getByRole("heading")).toHaveText(
    "Still editing"
  );
});

for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`offline and update views retain the approved design at ${width} in ${theme}`, async ({
      page,
      context,
      deployment,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(deployment.url);
      await prepareOffline(page);
      const todo = page.getByRole("region", { name: "Todo", exact: true });
      await todo.getByLabel("Column actions", { exact: true }).click();
      await todo.getByRole("button", { name: "Rename column" }).click();
      await page.getByLabel("Column name").fill("برنامه Board 42");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("article").click();
      await page.getByLabel("Title", { exact: true }).fill("نسخه UI 42");
      await page
        .getByLabel("Description")
        .fill("  فارسی UI.\nEnglish https://example.com (7).\n\nپایان!  ");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("Saved on this device");
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByRole("main")).toHaveCSS("color-scheme", theme);
      await expect(page.getByRole("article")).toContainText("نسخه UI 42");
      await expect(page.getByRole("heading", { level: 2 })).toHaveText([
        "برنامه Board 42",
        "Doing",
        "Done",
      ]);
      await expect(page).toHaveScreenshot(`offline-${width}-${theme}.png`);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      // Both the manual override and the system default work in an offline shell.
      await page.getByRole("button", { name: "Toggle theme" }).click();
      await expect(page.getByRole("main")).toHaveCSS(
        "color-scheme",
        theme === "light" ? "dark" : "light"
      );
      await page.getByRole("button", { name: "Toggle theme" }).click();
      await page.getByRole("article").click();
      await expect(page.getByLabel("Description")).toHaveValue(
        "  فارسی UI.\nEnglish https://example.com (7).\n\nپایان!  "
      );
      await page
        .getByLabel("Title", { exact: true })
        .fill("پیش‌نویس Draft 123");
      await expect(page).toHaveScreenshot(
        `offline-editor-${width}-${theme}.png`
      );
      await context.setOffline(false);
      deployment.publish();
      await checkForUpdate(page);
      await expect(
        page.getByText("Update available", { exact: true })
      ).toBeVisible();
      await expect(page).toHaveScreenshot(
        `update-editor-${width}-${theme}.png`
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page
        .getByRole("button", { name: "Reload to update" })
        .press("Enter");
      await expect(
        page.getByRole("button", { name: "Keep editing" })
      ).toBeFocused();
      await expect(page).toHaveScreenshot(
        `update-confirmation-${width}-${theme}.png`
      );
      await page.getByRole("button", { name: "Keep editing" }).press("Enter");
      await page
        .getByRole("button", { name: "Save", exact: true })
        .press("Enter");
      await expect(page.getByRole("status")).toHaveText("Saved on this device");
      await expect(page).toHaveScreenshot(`update-board-${width}-${theme}.png`);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page
        .getByRole("button", { name: "Reload to update" })
        .press("Enter");
      await expect(page).toHaveTitle("Doneward revision 2");
      await expect(page.getByRole("article")).toContainText(
        "پیش‌نویس Draft 123"
      );
      await expect(page.getByRole("main")).toHaveCSS("color-scheme", theme);
      await expect(page).toHaveScreenshot(`updated-${width}-${theme}.png`);
      await context.setOffline(true);
      await page.reload();
      await expect(page).toHaveTitle("Doneward revision 2");
      await expect(page.getByRole("article")).toContainText(
        "پیش‌نویس Draft 123"
      );
    });
  }
}

test("a failed update preparation leaves the previously prepared app usable offline", async ({
  page,
  context,
  deployment,
}) => {
  await page.goto(deployment.url);
  await prepareOffline(page);
  deployment.publish(true);
  await page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    await registration.update();
    const worker = registration.installing;
    if (worker)
      await new Promise<void>((resolve) => {
        worker.addEventListener("statechange", () => {
          if (worker.state === "redundant") resolve();
        });
        if (worker.state === "redundant") resolve();
      });
  });
  await expect(page.getByText("Update available", { exact: true })).toHaveCount(
    0
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("Doneward revision 1");
  await expect(page.getByRole("article")).toContainText("Welcome to Doneward");
});

test("a column draft can defer an update, save, and then reload", async ({
  page,
  deployment,
}) => {
  await page.goto(deployment.url);
  await prepareOffline(page);
  await page
    .getByRole("button", { name: "Add column", exact: true })
    .press("Enter");
  await page.getByLabel("Column name").fill("برنامه Queue");
  deployment.publish();
  await checkForUpdate(page);
  await page.getByRole("button", { name: "Reload to update" }).press("Enter");
  await page.getByRole("button", { name: "Keep editing" }).press("Enter");
  await expect(page.getByLabel("Column name")).toHaveValue("برنامه Queue");
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "Reload to update" }).press("Enter");
  await expect(page).toHaveTitle("Doneward revision 2");
  await expect(page.getByRole("heading", { level: 2 }).last()).toHaveText(
    "برنامه Queue"
  );
});

test.describe("touch updates", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("a touch user can keep a draft or explicitly discard it to update", async ({
    page,
    deployment,
  }) => {
    await page.goto(deployment.url);
    await prepareOffline(page);
    await page.getByRole("article").tap();
    await page.getByLabel("Title", { exact: true }).fill("Touch draft");
    deployment.publish();
    await checkForUpdate(page);
    await page.getByRole("button", { name: "Reload to update" }).tap();
    await page.getByRole("button", { name: "Keep editing" }).tap();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Touch draft"
    );
    await page.getByRole("button", { name: "Reload to update" }).tap();
    await page.getByRole("button", { name: "Discard and reload" }).tap();
    await expect(page).toHaveTitle("Doneward revision 2");
    await expect(page.getByRole("article")).toContainText(
      "Welcome to Doneward"
    );
  });
});
