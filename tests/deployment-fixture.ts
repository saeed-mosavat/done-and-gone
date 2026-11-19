import { createServer } from "node:http";
import { test as base, expect, type Page } from "@playwright/test";

export async function prepareOffline(page: Page) {
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => undefined)
  );
}

export async function checkForUpdate(page: Page) {
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())!.update();
  });
}

// A real HTTP deployment boundary: the production worker and chunks are served
// unchanged apart from a deployment identity and a visible HTML title.
export const test = base.extend<{
  deployment: { url: string; publish: (failPreparation?: boolean) => void };
}>({
  deployment: async ({}, provide) => {
    let revision = 1;
    let fail = false;
    const server = createServer(async (request, response) => {
      try {
        const url = request.url!;
        if (fail && url === "/") {
          response.writeHead(503).end("Deployment not ready");
          return;
        }
        const upstream = await fetch(`http://localhost:3100${url}`);
        response.statusCode = upstream.status;
        for (const header of ["content-type", "service-worker-allowed"])
          if (upstream.headers.has(header))
            response.setHeader(header, upstream.headers.get(header)!);
        response.setHeader("Cache-Control", "no-store");
        if (url === "/sw.js") {
          response.end(
            (await upstream.text()).replace(
              "doneward-app-",
              `doneward-app-deployment-${revision}-`
            )
          );
        } else if (url === "/") {
          response.end(
            (await upstream.text())
              .replace(
                "<title>Done &amp; Gone</title>",
                `<title>Done &amp; Gone revision ${revision}</title>`
              )
              .replace(
                String.raw`\"children\":\"Done \u0026 Gone\"`,
                String.raw`\"children\":\"Done \u0026 Gone revision ${revision}\"`
              )
          );
        } else {
          response.end(Buffer.from(await upstream.arrayBuffer()));
        }
      } catch {
        response.writeHead(502).end();
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No HTTP port");
    try {
      await provide({
        url: `http://127.0.0.1:${address.port}`,
        publish: (failPreparation = false) => {
          revision++;
          fail = failPreparation;
        },
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  },
});

export { expect };
