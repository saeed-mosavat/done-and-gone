# Service-worker delivery on Vercel

Verified 2026-11-19 against official Next.js/Vercel documentation and Vercel-owned source. Local application: Next.js 16.4.6, Turbopack. No Vercel deployment logs or packaged production function were obtained.

## Implementation follow-up

The assessment below records the earlier investigation, including the rejected
NFT patch. It is not a description of the current implementation.

- `scripts/build.mjs` now removes only the old generated `public/sw.js`, runs
  Next.js, then renders `scripts/service-worker.mjs` with the completed build's
  identity and sorted static inventory. The request-time route and NFT patch
  have been removed.
- When `.next/output/config.json` identifies Build Output API v3 output, the
  generator writes the same worker to `output/static/sw.js`. It does not depend
  on the host's missing-file synchronization to replace an older destination.
- `next.config.ts` configures worker response headers and explicitly generates
  unique build IDs. Next.js documents that a host-set `deploymentId` can make
  the default build ID constant; that would undermine isolated offline caches.
  [Build ID configuration][build-id]
- Local regression tests cover HTTP delivery, the exact complete inventory,
  asset availability, repeated real Next builds, preservation of unrelated
  public files, stale adapter output, and failed builds. The lifecycle fixture
  uses Next's real adapter API, not Vercel's package.
- Two additional application builds with the same `NEXT_DEPLOYMENT_ID` produced
  distinct build IDs and matching static workers, with no runtime worker route.
- A local check using the actual Vercel adapter package could not be completed:
  the isolated adapter lacked `@vercel/build-utils`, and installing its tooling
  dependencies timed out. No hosted preview has been deployed or verified.
  Production logs and final hosted HTTP verification remain outstanding.

## Assessment

**The trace patch is a plausible compatibility workaround, not a documented Vercel recommendation. Prefer generating the complete worker at build time and delivering it as a static file.** Keep the existing build identity, full final asset inventory, update semantics, and response headers; this is a delivery change, not a reason to redesign offline behavior.

Missing runtime `.next/static` files are a credible production hypothesis, **not a confirmed diagnosis**. An isolated route-trace deployment is not a faithful simulation of Vercel's complete function packaging: shared required files matter.

## What official sources confirm

- **Supported file-inclusion mechanism:** Next.js documents top-level `outputFileTracingIncludes`, keyed by route globs (here `/sw.js`), with file patterns relative to the project root. Traces list paths relative to their `.nft.json` file. The docs describe consuming traces, but do not recommend user scripts that modify them. Keep include patterns narrow. [Next.js output documentation][output]
- **Vercel explicitly directs Next.js users to that framework configuration.** Its `functions.includeFiles` setting is explicitly **not supported in Next.js**. The Vercel file-reading guide also recommends `process.cwd()`, which the existing route already uses. That guide's example still nests tracing options under `experimental`; follow the current Next.js reference for placement instead. [Vercel configuration][config], [file-reading guide][files]
- **Static assets are separate deployment outputs.** Next.js says standalone output omits `public` and `.next/static` by default because a CDN should ideally serve them. This standalone statement alone does not prove Vercel packaging behavior; Vercel's builder separately collects static/public files into deployment outputs while collecting function dependencies from traces and shared required files. CDN availability does not imply runtime filesystem availability. [Next.js output][output], [Vercel static collection][utils], [function packaging][server]
- **Service-worker delivery:** the current Next.js PWA guide demonstrates build-bundled worker code registered via `new URL(..., import.meta.url)`, `scope: '/'`, and `updateViaCache: 'none'`. Its `/sw.js` header example specifies JavaScript MIME, `Cache-Control: no-cache, no-store, must-revalidate`, and `Content-Security-Policy: default-src 'self'; script-src 'self'`. It names Serwist as an option for full offline caching, with Turbopack and webpack examples; it does not require Serwist or prescribe this application's custom precache algorithm. [Next.js PWA guide][pwa]
- **Static serving is a public interface:** files in `public` map to root URLs. Its default `Cache-Control: public, max-age=0` is not the PWA guide's worker-specific policy, so configure headers explicitly. [Public folder reference][public]

## What the proposed patch actually guarantees

Local `scripts/trace-service-worker.mjs` appends `.next/BUILD_ID` and every `.next/static` file to `.next/server/app/sw.js/route.js.nft.json`, preserving existing dependencies and removing `fileHashes`.

In the inspected Vercel builder's conventional server-build path:

1. The configured build command/package script finishes before function packaging.
2. Existing App Router `.js.nft.json` traces are read; `files` entries are resolved relative to the route output directory and collected into function files.
3. That reader consumes `files`, not `fileHashes`.

Thus the patch should affect this code path when `npm run build` actually runs. A dashboard override to plain `next build` would bypass it. This is an inference from implementation, not a support guarantee. [Builder sequencing][builder], [trace reader, lines 974–1047][server]

**Important caveats:**

- Next.js now documents Turbopack `fileHashes` as a positional parallel array, plus indexed `symlinks` metadata. Removing stale hashes avoids a mismatched array, and the inspected reader does not need them; this does **not** establish a general guarantee that every present/future consumer tolerates stripping them. Appending without reordering existing files preserves existing symlink indexes. [Trace extensions][output]
- The current builder also has an adapter/output path: when `.next/output/config.json` exists, it returns already-produced build output rather than running the conventional trace-packaging path. Editing a route trace after `next build` is therefore **not sufficient evidence that final function output changes** on that path. We have not established which path the production deployment uses. [Builder, lines 525–539 and 619–657][builder]
- Copying all static assets into a function duplicates CDN assets merely to discover their names. A generated worker can contain those URLs without shipping their bytes inside a function. This is an architectural inference from the current route and deployment separation, not an explicit prohibition by Vercel.

## Local evidence and limits

- The reported local `outputFileTracingIncludes` experiment for `/sw.js` produced no additional files. Installed `node_modules/next/dist/build/index.js:1660–1679` skips the JavaScript `collectBuildTraces` call for Turbopack. Its JS include/exclude implementation is in `collect-build-traces.js:437–546`. This supports investigating a bundler/timing limitation; it does **not** prove Turbopack never implements includes in native code.
- `BUILD_ID` is written at `index.js:1720`, after the cited tracing call. That ordering makes build-generated files awkward tracing inputs; it does not explain every missing static file or prove the production failure.
- Local `.next/required-server-files.json` includes `.next/BUILD_ID` and no `/static/` paths (reported local verification). Vercel's server builder explicitly adds **all** `requiredServerFilesManifest.files` to its shared function layer. Therefore an isolated route-only `ENOENT` for `BUILD_ID` is **not proof that production lacks `BUILD_ID`**. Missing `.next/static` is the stronger current hypothesis. [Shared required files, lines 787–817][server]
- Existing route headers are JavaScript MIME, `no-store`, and `Service-Worker-Allowed: /`. These satisfy the central delivery concerns, but are not identical to the guide's fuller cache directive and CSP example. No evidence here establishes missing CSP as the cause of the deployment failure.

## Practical recommendation

1. **Prefer build-generated static `/sw.js`.** After the successful build, read its actual `BUILD_ID` and complete final `.next/static` inventory, generate the existing `workerSource` output, and serve it as a deployment static asset. Preserve `/`, all existing asset URLs, cache identity and update behavior. Remove the competing route only as part of an explicitly authorized implementation.
2. **Preserve/configure worker response headers** in supported `next.config` headers or hosting configuration: JavaScript MIME, explicit non-caching policy, and the current root scope allowance; consider the guide's CSP after checking compatibility. Do not give the stable worker URL immutable caching.
3. **Verify build-output inclusion and freshness**, not merely creation of `public/sw.js`. The inspected builder explicitly syncs _missing_ post-build public files into adapter static output (its comment names service workers). It does not overwrite an existing destination: stale files from an earlier build/cache could therefore win. Ensure the final deployed worker matches the current build on both clean and cached builds. This source-level provision supports the approach, but is not a documented universal lifecycle guarantee. [Builder, lines 629–657][builder]
4. `compiler.runAfterProductionCompile` is supported, but runs **before** static generation. It is not automatically suitable for a worker requiring the **final** asset set and written `BUILD_ID`; do not substitute it without proving ordering and completeness. [Compiler lifecycle docs][compiler]
5. If retaining a dynamic endpoint, a smaller alternative is to generate **one manifest/worker payload**, then include that specific file through the documented tracing mechanism before packaging. This still requires proven lifecycle ordering and bundler inclusion. Merely switching to webpack or adding includes cannot guarantee a late-created file will exist when globbing occurs.
6. Before declaring either fix successful, inspect Vercel build/runtime logs and actual deployment output; request `/sw.js` and every listed asset, check headers and matching build identity, then exercise first installation, offline reopen, failed preparation, and a second deployment with an older tab still open. Test a cached rebuild too. A passing `next start` test alone does not validate Vercel packaging.

**If urgent:** the NFT patch can be retained temporarily only with a verified Vercel preview deployment, explicit acknowledgement of implementation coupling, and regression checks on final packaged output. Do not describe it in README/tickets as “Vercel's recommended solution,” or state a confirmed production cause without logs.

## Deeper build-lifecycle verification

The following clarifies the recommendation; no replacement implementation has
been finalized.

- The companion [Next.js delivery-patterns study](nextjs-service-worker-patterns.md)
  covers the exact Next.js 16.4.6 native Turbopack worker support and Serwist's
  newer, bundler-agnostic configurator. Static generation is not the only
  supported delivery choice; the unresolved question is complete inventory
  generation and deployment ordering, not whether Next.js can bundle a worker.
- **The conventional builder collects public files after the build command.**
  `getStaticFiles` collects `public/**/*` as root deployment URLs and
  `.next/static/**/*` under `/_next/static/`. Thus a successfully generated
  `public/sw.js` is a static deployment asset, not a function that needs to read
  the CDN's files. [Static collection, lines 3667–3725][utils]
- **The adapter path is conditional, not established for this deployment.**
  The inspected builder enables it with `NEXT_ENABLE_ADAPTER=1` and a minimum
  Next.js version. It supplies `NEXT_ADAPTER_PATH` before invoking the build.
  When `.next/output/config.json` is present afterward, it returns that output.
  A post-build NFT patch cannot be assumed to change already-packaged functions.
  [Adapter selection, lines 525–539; output selection, lines 618–657][builder]
- **Post-build public-file generation is explicitly anticipated.** The builder's
  synchronization comment specifically names service workers from Serwist.
  However, it copies only files whose destination does not exist. Consequently,
  creation of a fresh source worker is not proof of freshness in adapter output
  if an older worker was present at build start. This is source-level evidence
  of an integration path, not a universal documented hook contract.
  [Post-build synchronization, lines 629–650][builder]
- **Do not overstate the default build-cache risk.** The inspected Next.js
  `prepareCache` retains dependencies, `.next/cache`, and Yarn cache; it does
  not retain generated `public/sw.js` or `.next/output`. Vercel's docs likewise
  state that `.vercel/output` is never cached. A stale source worker at build
  start is a repeated-workspace/custom-cache/checked-in-artifact scenario to
  test, not a demonstrated consequence of Vercel's default Next.js cache.
  [Cache manifest, lines 3089–3135][builder], [Build-cache documentation][cache]
- **The final deployment output is the verification boundary.** The Build
  Output API serves static assets from `.vercel/output/static` at root URLs;
  function files belong to separate `.func` directories. Verify the worker
  in the final output selected by the builder, not merely in source `public/`
  or an intermediate NFT. Use Vercel's Resources/Source views to confirm what
  was actually deployed. [Output primitives][primitives], [Troubleshooting
  views][troubleshoot]
- **Adapter versions and feature flags matter.** The inspected Vercel builder
  bundles `@next-community/adapter-vercel@0.0.1-beta.34`. The adapter's source
  implements `onBuildComplete`, handles public/static output, and conditionally
  enables immutable-asset support. This is another reason to verify the deployed
  URL inventory rather than assume every deployment has the same output layout.
  The inspected source HEAD is not proof of the version used in production.
  [Builder dependency][builder-package], [Adapter source][adapter]

### Acceptance evidence required before choosing a fix

1. Establish the production builder path and capture the `/sw.js` runtime error
   from Vercel logs; do not substitute a route-only filesystem simulation.
2. Build two revisions on a clean workspace and then on a reused workspace.
   The final worker must embed the corresponding build identity and reference
   only assets present in the same deployment. Include a worker left from the
   previous build in the reused-workspace case.
3. Verify both normal Next.js serving and Vercel's final static output. If using
   a standalone server, explicitly include the public and static directories as
   required by the Next.js output docs.
4. Check HTTP 200, JavaScript MIME, no stale caching of the stable worker URL,
   root scope, and successful requests for every precache URL.
5. Preserve atomic preparation, explicit update acceptance, old-tab chunks, and
   offline reopening; a library's default immediate activation/cache cleanup
   behavior must not silently replace these product requirements.

[output]: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
[config]: https://vercel.com/docs/project-configuration/vercel-json#functions
[files]: https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions
[pwa]: https://nextjs.org/docs/app/guides/progressive-web-apps
[public]: https://nextjs.org/docs/app/api-reference/file-conventions/public-folder
[compiler]: https://nextjs.org/docs/architecture/nextjs-compiler#build-lifecycle-hooks
[builder]: https://github.com/vercel/vercel/blob/155eacfa16840e68ae54bc50ee72fc8e16733857/packages/next/src/index.ts
[server]: https://github.com/vercel/vercel/blob/155eacfa16840e68ae54bc50ee72fc8e16733857/packages/next/src/server-build.ts
[utils]: https://github.com/vercel/vercel/blob/155eacfa16840e68ae54bc50ee72fc8e16733857/packages/next/src/utils.ts
[cache]: https://vercel.com/docs/deployments/troubleshoot-a-build#what-is-cached
[primitives]: https://vercel.com/docs/build-output-api/primitives
[troubleshoot]: https://vercel.com/docs/deployments/troubleshoot-a-build#troubleshooting-views
[builder-package]: https://github.com/vercel/vercel/blob/155eacfa16840e68ae54bc50ee72fc8e16733857/packages/next/package.json
[adapter]: https://github.com/nextjs/adapter-vercel/blob/3f3e2d295046243cd8fb83e193e7668ca913e65b/packages/adapter/src/index.ts
[build-id]: https://nextjs.org/docs/app/api-reference/config/next-config-js/generateBuildId
