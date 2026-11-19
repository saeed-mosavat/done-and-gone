import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { workerSource } from "./service-worker.mjs";

// Never let Next.js or a hosting adapter collect a previous build's worker.
// Only this generated file is removed; other public assets are untouched.
const worker = path.resolve("public/sw.js");
await rm(worker, { force: true });
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve("next/dist/bin/next")),
    "build",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" }
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Discover generated files only after the entire build, including prerendering.
const build = path.resolve(".next");
const version = (await readFile(path.join(build, "BUILD_ID"), "utf8")).trim();
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
if (!version || !assets.length) throw new Error("Incomplete offline build");
const source = workerSource(version, ["/", ...assets]);
await mkdir(path.dirname(worker), { recursive: true });
await writeFile(worker, source);

// Vercel's adapter can finish packaging during next build. Publish the same
// worker into its Build Output API static directory, not into function traces.
const output = path.join(build, "output");
const outputConfig = await readFile(
  path.join(output, "config.json"),
  "utf8"
).catch((error) => {
  if (error.code === "ENOENT") return undefined;
  throw error;
});
if (outputConfig !== undefined) {
  if (JSON.parse(outputConfig).version !== 3)
    throw new Error("Unsupported deployment output version");
  await mkdir(path.join(output, "static"), { recursive: true });
  await writeFile(path.join(output, "static/sw.js"), source);
}
