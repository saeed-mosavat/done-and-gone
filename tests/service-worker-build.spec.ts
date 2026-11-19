import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";

const execute = promisify(execFile);

test("successive builds publish a fresh static worker after adapter packaging", async ({
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== "chromium",
    "Build lifecycle is browser-independent"
  );
  test.setTimeout(120_000);
  const root = testInfo.outputPath("application");
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "app"));
  await mkdir(path.join(root, "public"));
  await symlink(path.resolve("node_modules"), path.join(root, "node_modules"));
  for (const file of ["build.mjs", "service-worker.mjs"]) {
    await copyFile(
      path.join("scripts", file),
      path.join(root, "scripts", file)
    );
  }
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "worker-build-fixture",
      private: true,
      type: "module",
    })
  );
  await writeFile(
    path.join(root, "next.config.mjs"),
    `export default {
      turbopack: { root: ${JSON.stringify(process.cwd())} },
      adapterPath: ${JSON.stringify(path.join(root, "adapter.mjs"))},
      generateBuildId: () => process.env.WORKER_TEST_REVISION,
    };`
  );
  // Exercise the real Next adapter lifecycle, without coupling the regression
  // to one release of Vercel's adapter. It emits output before the wrapper's
  // generation step, deliberately including an old destination worker.
  await writeFile(
    path.join(root, "adapter.mjs"),
    `import assert from "node:assert/strict";
    import { mkdir, readFile, writeFile } from "node:fs/promises";
    import path from "node:path";
    export default {
      name: "static-worker-lifecycle-fixture",
      async onBuildComplete({ projectDir, distDir }) {
        await assert.rejects(readFile(path.join(projectDir, "public/sw.js")), { code: "ENOENT" });
        await mkdir(path.join(distDir, "output/static"), { recursive: true });
        await writeFile(path.join(distDir, "output/config.json"), '{"version":3}');
        await writeFile(path.join(distDir, "output/static/sw.js"), "older adapter worker");
      }
    };`
  );
  await writeFile(
    path.join(root, "app/layout.js"),
    "export default function Layout({children}) { return <html><body>{children}</body></html>; }"
  );
  await writeFile(path.join(root, "public/keep.txt"), "unrelated public asset");

  let previous = "";
  for (const revision of ["revision-one", "revision-two"]) {
    // Also cover a worker left in public by a previous build or custom cache.
    await writeFile(path.join(root, "public/sw.js"), previous || "old worker");
    await writeFile(
      path.join(root, "app/page.js"),
      `export default function Page() { return <main>${revision}</main>; }`
    );
    await execute(process.execPath, ["scripts/build.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        NEXT_ADAPTER_PATH: path.join(root, "adapter.mjs"),
        WORKER_TEST_REVISION: revision,
      },
      timeout: 50_000,
    });
    const source = await readFile(path.join(root, "public/sw.js"), "utf8");
    expect(source).not.toBe(previous);
    expect(
      await readFile(path.join(root, ".next/output/static/sw.js"), "utf8")
    ).toBe(source);
    expect(await readFile(path.join(root, "public/keep.txt"), "utf8")).toBe(
      "unrelated public asset"
    );
    const inventory = runInNewContext(
      source + "\n;({ cache: CACHE, assets: ASSETS })",
      { self: { addEventListener() {} } }
    );
    expect(inventory.cache).toBe(`doneward-app-${revision}`);
    expect(inventory.assets[0]).toBe("/");
    expect(inventory.assets.length).toBeGreaterThan(1);
    for (const url of inventory.assets.slice(1)) {
      await expect(
        readFile(path.join(root, ".next", url.replace("/_next/", "")))
      ).resolves.toBeInstanceOf(Buffer);
    }
    previous = source;
  }

  // Failed builds must not leave a previous public worker ready to publish.
  await expect(
    execute(process.execPath, ["scripts/build.mjs", "--not-a-next-option"], {
      cwd: root,
    })
  ).rejects.toThrow();
  await expect(readFile(path.join(root, "public/sw.js"))).rejects.toMatchObject(
    {
      code: "ENOENT",
    }
  );
});
