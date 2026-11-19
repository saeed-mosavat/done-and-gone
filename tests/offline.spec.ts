import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { prepareOffline } from "./deployment-fixture";

test("a prepared board reopens offline and saves card changes across reloads", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await prepareOffline(page);
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto("/");
  await expect(offline.getByRole("article")).toContainText(
    "Welcome to Done & Gone"
  );
  await offline
    .getByRole("button", { name: "Add a card", exact: true })
    .first()
    .click();
  await expect(offline.getByLabel("Column", { exact: true })).toHaveCount(0);
  await offline.getByLabel("Title", { exact: true }).fill("برنامه Offline 123");
  await offline
    .getByLabel("Description")
    .fill("یادداشت English\nEnglish فارسی");
  await offline.getByRole("button", { name: "Save", exact: true }).click();
  await expect(offline.getByRole("status")).toHaveText("Saved on this device");
  await offline.reload();
  await offline
    .getByRole("article")
    .filter({ hasText: "برنامه Offline 123" })
    .click();
  await offline.getByLabel("Title", { exact: true }).fill("ویرایش Offline");
  await offline.getByRole("button", { name: "Save", exact: true }).click();
  await expect(offline.getByRole("status")).toHaveText("Saved on this device");
  await offline.reload();
  await offline
    .getByRole("article")
    .filter({ hasText: "ویرایش Offline" })
    .click();
  await expect(offline.getByLabel("Description")).toHaveValue(
    "یادداشت English\nEnglish فارسی"
  );
  await offline
    .getByRole("button", { name: "Delete card", exact: true })
    .click();
  await offline.getByRole("button", { name: "Delete permanently" }).click();
  await expect(offline.getByRole("status")).toHaveText("Saved on this device");
  await offline.reload();
  await expect(offline.getByRole("article")).toHaveCount(1);
  await expect(offline.getByRole("article")).toContainText(
    "Welcome to Done & Gone"
  );
});

test("offline column management, movement, ordering, and backup round trips survive reopening", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await prepareOffline(page);
  await context.setOffline(true);
  await page.reload();
  const saved = () =>
    expect(page.getByRole("status")).toHaveText("Saved on this device");
  const doing = page.getByRole("region", { name: "Doing", exact: true });
  await doing.getByLabel("Column actions", { exact: true }).press("Enter");
  await doing
    .getByRole("button", { name: "Move column left", exact: true })
    .press("Enter");
  await saved();
  await page.getByRole("article").click();
  await page
    .getByLabel("Column", { exact: true })
    .selectOption({ label: "1. Doing" });
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await saved();
  await doing.getByRole("button", { name: "Add a card", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Next قدم");
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await saved();
  await doing.getByRole("article").last().click();
  await page.getByLabel("Position", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Save", exact: true }).press("Enter");
  await saved();
  await page.getByRole("button", { name: "Add column", exact: true }).click();
  await page.getByLabel("Column name").fill("Temporary");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await saved();
  const temporary = page.getByRole("region", {
    name: "Temporary",
    exact: true,
  });
  await temporary.getByLabel("Column actions", { exact: true }).click();
  await temporary
    .getByRole("button", { name: "Rename column", exact: true })
    .click();
  await page.getByLabel("Column name").fill("Offline column");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await saved();
  const renamed = page.getByRole("region", {
    name: "Offline column",
    exact: true,
  });
  await renamed.getByLabel("Column actions", { exact: true }).click();
  await renamed
    .getByRole("button", { name: "Delete column", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete column", exact: true })
    .click();
  await saved();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Doing",
    "Todo",
    "Done",
  ]);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Next قدم",
    "Welcome to Done & Gone",
  ]);
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadPromise;
  const backup = await readFile((await download.path())!);
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        columns: [{ id: "empty", name: "Empty", cards: [] }],
      })
    ),
  });
  await page
    .getByRole("button", { name: "Replace board", exact: true })
    .click();
  await saved();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Empty"]);
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await page
    .getByRole("button", { name: "Replace board", exact: true })
    .click();
  await saved();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.getByRole("heading", { level: 2 })).toHaveText([
    "Doing",
    "Todo",
    "Done",
  ]);
  await expect(reopened.getByRole("heading", { level: 3 })).toHaveText([
    "Next قدم",
    "Welcome to Done & Gone",
  ]);
});

test("offline tabs receive saved changes and hand editing access to a waiting tab", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await prepareOffline(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  const reader = await context.newPage();
  await reader.goto("/");
  await expect(reader.getByRole("note")).toContainText("Read-only");
  await expect(
    reader.getByRole("button", { name: "Add column", exact: true })
  ).toBeDisabled();
  await page.getByRole("article").click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Offline broadcast فارسی");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await expect(reader.getByRole("article")).toContainText(
    "Offline broadcast فارسی"
  );
  await page.close();
  await expect(
    reader.getByRole("button", { name: "Add column", exact: true })
  ).toBeEnabled();
  await reader.getByRole("article").click();
  await reader.getByLabel("Title", { exact: true }).fill("Offline handoff");
  await reader.getByRole("button", { name: "Save", exact: true }).click();
  await expect(reader.getByRole("status")).toHaveText("Saved on this device");
  await reader.reload();
  await expect(reader.getByRole("article").getByRole("heading")).toHaveText(
    "Offline handoff"
  );
});
