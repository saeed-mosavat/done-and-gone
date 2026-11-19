import { expect, test } from "@playwright/test";

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
