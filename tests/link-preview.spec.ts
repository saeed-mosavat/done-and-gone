import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ javaScriptEnabled: false });

test("link previews expose the supplied image without running JavaScript", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const imageURL = "https://done-and-gone.vercel.app/done-and-gone-preview.jpg";
  for (const [property, content] of Object.entries({
    "og:type": "website",
    "og:url": "https://done-and-gone.vercel.app",
    "og:site_name": "Done & Gone",
    "og:title": "Done & Gone",
    "og:description": "Your personal task board.",
    "og:image": imageURL,
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:type": "image/jpeg",
    "og:image:alt":
      "Done & Gone task board with Todo, Doing, and Done columns.",
  })) {
    await expect(
      page.locator(`head meta[property="${property}"]`)
    ).toHaveAttribute("content", content);
  }
  for (const [name, content] of Object.entries({
    "twitter:card": "summary_large_image",
    "twitter:title": "Done & Gone",
    "twitter:description": "Your personal task board.",
    "twitter:image": imageURL,
    "twitter:image:alt":
      "Done & Gone task board with Todo, Doing, and Done columns.",
  })) {
    await expect(page.locator(`head meta[name="${name}"]`)).toHaveAttribute(
      "content",
      content
    );
  }

  const image = await request.get(new URL(imageURL).pathname);
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/jpeg");
  expect(await image.body()).toEqual(
    await readFile("public/done-and-gone-preview.jpg")
  );
});
