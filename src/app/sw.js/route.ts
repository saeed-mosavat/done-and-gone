import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { workerSource } from "../../offline/worker";

export const dynamic = "force-dynamic";

export async function GET() {
  // Development assets are not immutable and must never be installed offline.
  if (process.env.NODE_ENV !== "production") {
    return new Response("", { status: 404 });
  }
  const build = path.join(process.cwd(), ".next");
  const version = (await readFile(path.join(build, "BUILD_ID"), "utf8")).trim();
  const files = await readdir(path.join(build, "static"), {
    recursive: true,
    withFileTypes: true,
  });
  const assets = files
    .filter((file) => file.isFile())
    .map(
      (file) =>
        "/_next/static/" +
        path.relative(
          path.join(build, "static"),
          path.join(file.parentPath, file.name)
        )
    );
  return new Response(workerSource(version, ["/", ...assets]), {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  });
}
