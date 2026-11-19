import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";

test("the service worker is a static build artifact with the complete asset inventory", async ({
  request,
}) => {
  const build = path.resolve(".next");
  const staticRoot = path.join(build, "static");
  const files = await readdir(staticRoot, {
    recursive: true,
    withFileTypes: true,
  });
  const assets = files
    .filter((file) => file.isFile())
    .map(
      (file) =>
        "/_next/static/" +
        path
          .relative(staticRoot, path.join(file.parentPath, file.name))
          .split(path.sep)
          .join("/")
    )
    .sort();

  // A static artifact can be deployed without any runtime .next filesystem.
  const artifact = await readFile("public/sw.js", "utf8");
  const response = await request.get("/sw.js");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain(
    "application/javascript"
  );
  expect(response.headers()["cache-control"]).toBe(
    "no-cache, no-store, must-revalidate"
  );
  expect(response.headers()["service-worker-allowed"]).toBe("/");
  const source = await response.text();
  expect(source).toBe(artifact);
  const version = (await readFile(path.join(build, "BUILD_ID"), "utf8")).trim();
  const inventory = runInNewContext(
    source + "\n;({ cache: CACHE, assets: ASSETS })",
    { self: { addEventListener() {} } }
  );
  expect(inventory.cache).toBe(`doneward-app-${version}`);
  expect(inventory.assets).toEqual(["/", ...assets]);
  for (const url of inventory.assets) {
    const asset = await request.get(url);
    expect(asset.status(), url).toBe(200);
  }
});
