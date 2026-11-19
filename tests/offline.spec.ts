import { expect, test } from "@playwright/test";

test("a prepared board reopens offline and saves card changes across reloads", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => undefined)
  );
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto("/");
  await expect(offline.getByRole("article")).toContainText(
    "Welcome to Doneward"
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
    "Welcome to Doneward"
  );
});
