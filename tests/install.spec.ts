import { expect, test } from "@playwright/test";

test("the board advertises a standalone installation with an in-scope launch URL and install icons", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const link = page.locator('link[rel="manifest"]');
  await expect(link).toHaveAttribute("href", /.+/);
  const manifestURL = new URL((await link.getAttribute("href"))!, page.url());
  const response = await request.get(manifestURL.href);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain(
    "application/manifest+json"
  );
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "Done & Gone",
    short_name: "Done & Gone",
    display: "standalone",
    start_url: "/",
    scope: "/",
  });
  const startURL = new URL(manifest.start_url, manifestURL);
  const scopeURL = new URL(manifest.scope, manifestURL);
  expect(startURL.origin).toBe(new URL(page.url()).origin);
  expect(startURL.href.startsWith(scopeURL.href)).toBe(true);
  expect((await request.get(startURL.href)).ok()).toBe(true);

  for (const size of [192, 512]) {
    const icon = manifest.icons.find(
      (candidate: { sizes: string }) => candidate.sizes === `${size}x${size}`
    );
    expect(icon).toMatchObject({ type: "image/png", purpose: "any" });
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, new URL(icon.src, manifestURL).href);
    expect(dimensions).toEqual({ width: size, height: size });
  }
});
