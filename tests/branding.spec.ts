import { expect, test } from "@playwright/test";
import { prepareOffline } from "./deployment-fixture";

test("the supplied branding follows system and manual themes, including offline", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page).toHaveTitle("Done & Gone");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "Done & Gone"
  );
  const light = page.locator(".brand-light");
  const dark = page.locator(".brand-dark");
  await expect(dark).toBeVisible();
  await expect(light).toBeHidden();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(light).toBeVisible();
  await expect(dark).toBeHidden();

  await prepareOffline(page);
  await context.setOffline(true);
  await page.reload();
  for (const logo of [dark, light]) {
    if (!(await logo.isVisible())) {
      await page.getByRole("button", { name: "Toggle theme" }).click();
    }
    await expect(logo).toBeVisible();
    await expect(logo).toHaveJSProperty("complete", true);
    expect(
      await logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)
    ).toBeGreaterThan(0);
  }
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute(
    "href",
    /\/_next\/static\/media\/done-and-gone-logo\..+\.png/
  );
  const iconLoaded = await page.evaluate(
    async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image.naturalWidth > 0;
    },
    (await icon.getAttribute("href"))!
  );
  expect(iconLoaded).toBe(true);
});
