# Next.js service-worker delivery patterns

Research date: 2026-11-19. Scope: framework/library delivery patterns and browser semantics, **not a finalized fix**. Vercel adapter ordering, cached builds, and final static collection are investigated separately in [the deployment note](vercel-service-worker-deployment.md).

This study predates implementation. References below to `src/app/sw.js/route.ts`
and `src/offline/worker.ts` describe the original code; see the deployment note's
implementation follow-up for the build-generated replacement and validation
limits.

## Version and evidence boundaries

- This app pins **Next.js 16.4.6**, uses default Turbopack, and has no Serwist dependency. Checked the installed PWA guide and upstream **16.4.6 source**, pinned to commit `54b876b6b161b0ecda19562eb264bec637e60d6d`, rather than assuming current documentation describes every older Next release.
- Serwist source is pinned to main HEAD `55f2ab0bc20d3286e0f40162fc577daed02624cc` (2026-11-17), packages **9.5.15**. Both Next integrations declare `next >=14.0.0`; their development dependency is 16.3.8. This admits 16.4.6 but is **not proof of end-to-end compatibility** with this app or its deployment. [Package manifests][serwist-next-package], [Turbopack package][serwist-turbo-package]
- **Evidence** below means inspected first-party docs/source or local application code. **Inference** means an application-specific assessment; no new build/deployment experiment was performed.

## Supported delivery patterns: evidence

### 1. Root static file, handwritten or build-generated

Next's public-file convention maps `public/sw.js` to `/sw.js`; its official service-worker example registers that URL. Public files default to `Cache-Control: public, max-age=0`. The PWA guide demonstrates explicit JavaScript MIME and `no-cache, no-store, must-revalidate` worker headers in `next.config` (plus an example CSP). This does not require a runtime filesystem-reading endpoint or a library. [Public convention][public], [16.4.6 example][static-example], [PWA guide][pwa]

**Important distinction:** serving a file from `public` is a documented interface; producing it after `next build` and having a hosting adapter collect the fresh file is a separate lifecycle question. Serwist now officially documents exactly that postbuild generation pattern, but that is not a universal Next/Vercel packaging guarantee. [Configurator guide][config-guide]

`compiler.runAfterProductionCompile` is documented to run **before static generation**, not after the whole build. It is not automatically an appropriate point for the final asset inventory. [Compiler hook][compiler]

### 2. Native Turbopack service-worker bundling exists in 16.4.6

This is specifically:

```js
navigator.serviceWorker.register(
  new URL("../lib/service-worker.js", import.meta.url),
  { scope: "/", updateViaCache: "none" }
);
```

It is **not** `new Worker(...)` (which creates a dedicated worker, not a service-worker registration). The current and installed PWA guides show this registration syntax. The 16.4.6 implementation discovers service-worker entries, bundles each as one self-contained output, and rewrites registration to `/_next/static/service-worker/sw.js` for root scope, preserving other registration options. Distinct scopes have distinct names; multiple different source files for the same scope produce an error. [Guide][pwa], [Compiler implementation][native-compile], [Registration codegen][native-codegen]

Next's 16.4.6 end-to-end tests explicitly call this **Turbopack-only** and assert root/base-path scope, `Service-Worker-Allowed`, stable script URL, mutable `max-age=0` rather than immutable caching, ETag/304, and preservation of `updateViaCache`. These are source/test guarantees for Next's serving path, not verification of every external host. [Tests][native-tests]

**Inference:** this removes custom worker bundling/delivery plumbing, but does **not** by itself solve this app's final build ID and complete precache inventory. The inspected native compiler bundles the worker source; no app-wide precache-manifest injection API appears there. Adopting it still needs an inventory-generation design, and the worker itself is now under `.next/static`: blindly retaining “cache every static file as immutable” would include a **mutable service-worker file**.

### 3. Serwist has three materially different Next integrations

| Integration                              | First-party mechanism                                                                                                                                                                                                                                                                                    | Consequence for this app                                                                                                                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classic `@serwist/next` webpack wrapper  | `InjectManifest` webpack plugin; typical destination `public/sw.js`; compilation assets plus public files. Source explicitly warns it does not support Turbopack.                                                                                                                                        | Requires webpack (`next build --webpack`) if using this integration. Plugin runs before prerendering; it cannot automatically discover final prerendered HTML.                                                               |
| `@serwist/turbopack`                     | `createSerwistRoute` exports `force-static`, `generateStaticParams`, `GET`, etc.; globs filesystem inputs and uses esbuild to inject/bundle a worker; `/serwist/sw.js` in the example, with root allowance header. Source calls it a workaround, and the webpack warning calls its support experimental. | Not the same as this app's force-dynamic runtime route: intended output is prerendered. Still needs inventory/timing verification. The inspected implementation says it is for configurations **without `cacheComponents`**. |
| **Configurator mode, introduced in 9.4** | `@serwist/next/config` generates CLI configuration; documented script is `next build && serwist build`, destination `public/sw.js`; bundler-agnostic, automatically discovers prerendered HTML by default.                                                                                               | A realistic Turbopack-compatible build-time alternative. Does not require switching to webpack or the experimental route workaround. Final hosting collection remains a separate check.                                      |

Sources: [webpack guide][webpack-guide], [webpack source][webpack-source], [Turbopack guide][turbo-guide], [route implementation][turbo-source], [configurator guide][config-guide], [configurator source][config-source].

**Do not copy starter defaults unchanged.** Examples use `skipWaiting: true`, `clientsClaim: true`, `runtimeCaching: defaultCache`, and navigation preload. Immediate activation conflicts with this app's explicit “Reload to update” gate; general runtime caching/offline fallback is not equivalent to atomically preparing the entire working board. Preserve the custom registration/update policy or deliberately reimplement it; do not run two competing registration systems. [Setup examples][config-guide], local `src/offline/use-app-update.ts` and `src/offline/worker.ts`

## Inventory, identity, and caching: evidence versus inference

**Local evidence:** `src/app/sw.js/route.ts` reads actual `.next/BUILD_ID` and **every file** under `.next/static` on each production request, then embeds `["/", ...assets]`. `workerSource` uses a deployment-specific cache, waits for all downloads, deletes that new cache on failure, retains older caches, and only calls `skipWaiting` after `APPLY_UPDATE`. Registration uses stable `/sw.js`, root scope, `updateViaCache: "none"`, and explicit checks on reconnection/visibility.

**Library evidence:** Serwist configurator and Turbopack default glob patterns include selected static extensions and `public/**/*`—**not literally every static file**. The inspected extension list omits fonts such as `.woff2`/`.woff`, source maps, and other extensions. Configurator adds prerendered HTML; the Turbopack route defaults do not. The documented default file-size ceiling is **2 MiB**, so matching a glob alone does not establish inclusion. Classic webpack inventory uses compilation assets instead and should not be assumed to share those exact glob omissions. [Configurator glob source][config-globs], [Turbopack glob source][turbo-globs], [Size limit][size-limit], [webpack source][webpack-source]

**Inference for this app:** any replacement must compare the emitted manifest against the full final static inventory (including fonts and lazily loaded chunks), explicitly include `/`, and account for size/exclusion filters. Runtime caching only downloads what was requested; it is not proof that unvisited board features work offline. All-static inventory is conservative and may include unnecessary files; reducing it is a separate behavioral decision, not an incidental delivery fix.

**Browser evidence:** updates are detected by worker-script resource byte differences, not by a cache name convention alone. Revisioned precache manifests make unversioned URLs such as HTML update alongside hashed assets. Workbox's official documentation illustrates build-generated revisions and warns against manually hardcoding them; its default activation cleanup deletes assets absent from the new manifest. This is useful reference behavior, **not a claim that every Serwist configuration has identical internals**. [Service-worker update algorithm][sw-update], [Workbox precaching][workbox]

**Inference:** preserve a worker byte change and isolated cache identity whenever the shell/assets change; a random runtime ID would repeatedly trigger installs, while a reused Git SHA is not necessarily the identity of build-dependent HTML. Sorting generated inventory makes output deterministic. Keeping all old caches supports older open tabs but grows storage; adopting a library's automatic cleanup without testing old-tab chunk loads would change the current contract.

## Browser delivery requirements

- **Secure, same-origin script and scope:** service-worker registration is restricted to secure contexts and same-origin script/scope URLs. HTTPS is the production baseline; loopback/localhost are potentially trustworthy development exceptions. `new Worker` or a blob workaround is not a substitute. [Service-worker security][sw-security], [secure contexts][secure-contexts]
- **JavaScript response, successful fetch:** the update algorithm checks JavaScript MIME and response success; an HTML error/login page at `/sw.js` is not a valid worker. Inspect actual responses, not only route source. [Update algorithm][sw-update]
- **Scope is not widened by registration options alone:** default maximum scope is the script's directory. `/sw.js` can already cover `/`; `Service-Worker-Allowed: /` is redundant there but necessary for a nested worker that requests root scope. Native Next and Serwist's nested route explicitly address this. [Path restriction][sw-path], [Next tests][native-tests], [Serwist route][turbo-source]
- **Keep stable script URLs mutable:** `updateViaCache: "none"` bypasses browser HTTP-cache use for worker scripts/imports during checks, not an upstream CDN's stale response policy and not application Cache Storage. Keep appropriate worker response headers even with this option; do not give stable worker URLs immutable caching. Cache Storage and HTTP caching are separate mechanisms. [Update algorithm][sw-update], [cache lifetime][sw-cache], [Next tests][native-tests]
- **Installation and activation differ:** rejected install work does not activate the new worker; `skipWaiting` accelerates activation, and `clients.claim` can change which worker controls open pages without reloading their JavaScript. This app's draft-preserving update behavior must survive a delivery/library change. [Lifecycle algorithms][sw-install], local worker/registration

## Options to carry into the parent decision

1. **Custom build-generated static `/sw.js`: smallest behavioral scope (inference).** Reuse `workerSource`, actual final build ID, and complete inventory; keep current registration/update semantics. No new caching dependency. Must prove fresh postbuild file reaches the deployed output and preserve headers; cannot conclude that from `next start` alone.
2. **Serwist configurator: strongest documented library match for final-inventory generation.** Works with Turbopack and has an explicitly post-prerender build step. Adds dependencies/configuration and requires inventory overrides plus careful adaptation of activation, cache retention, and board-shell behavior. Not automatically safer merely because it is a library.
3. **Native Turbopack registration: real supported candidate in this exact version.** Excellent for bundling/delivery; no demonstrated final-manifest solution yet. Investigate only if avoiding custom/static generation warrants the extra design. A migration must consider existing `/sw.js` registrations and avoid self-precaching mutable worker output.
4. **Retain dynamic delivery with a pre-generated small payload:** can preserve URL/behavior without runtime discovery of the entire static tree. Requires proven inclusion of that one payload; filesystem packaging remains relevant. This is an application inference, not a first-party service-worker recipe.
5. **Classic webpack Serwist / Turbopack route integration:** both legitimate documented choices, but neither is necessary just to serve a worker. Switching bundlers broadens scope; the route workaround offers less obvious benefit than configurator for this final-inventory requirement.

**Open checks, not resolved here:** which lifecycle produces a fresh worker in the final host output on clean/cached builds; whether native worker delivery headers survive the target adapter; precise manifest diff for this build (especially fonts and excluded large files); shell/build identity agreement during deployment transitions; failed installation, offline reopen of unvisited features, and two deployments with an old tab/draft still open. No application code changed and no fix selected.

[public]: https://nextjs.org/docs/app/api-reference/file-conventions/public-folder
[static-example]: https://github.com/vercel/next.js/blob/54b876b6b161b0ecda19562eb264bec637e60d6d/examples/with-service-worker/pages/index.tsx
[pwa]: https://nextjs.org/docs/app/guides/progressive-web-apps
[compiler]: https://nextjs.org/docs/architecture/nextjs-compiler#build-lifecycle-hooks
[native-compile]: https://github.com/vercel/next.js/blob/54b876b6b161b0ecda19562eb264bec637e60d6d/crates/next-api/src/service_worker.rs
[native-codegen]: https://github.com/vercel/next.js/blob/54b876b6b161b0ecda19562eb264bec637e60d6d/turbopack/crates/turbopack-ecmascript/src/references/service_worker.rs
[native-tests]: https://github.com/vercel/next.js/blob/54b876b6b161b0ecda19562eb264bec637e60d6d/test/e2e/app-dir/service-worker/service-worker-register.test.ts
[serwist-next-package]: https://github.com/serwist/serwist/blob/55f2ab0bc20d3286e0f40162fc577daed02624cc/packages/next/package.json
[serwist-turbo-package]: https://github.com/serwist/serwist/blob/55f2ab0bc20d3286e0f40162fc577daed02624cc/packages/turbo/package.json
[webpack-guide]: https://serwist.pages.dev/docs/next/getting-started
[webpack-source]: https://github.com/serwist/serwist/blob/55f2ab0bc20d3286e0f40162fc577daed02624cc/packages/next/src/index.ts
[turbo-guide]: https://serwist.pages.dev/docs/next/turbo
[turbo-source]: https://github.com/serwist/serwist/blob/55f2ab0bc20d3286e0f40162fc577daed02624cc/packages/turbo/src/index.ts
[config-guide]: https://serwist.pages.dev/docs/next/config
[config-source]: https://github.com/serwist/serwist/blob/55f2ab0bc20d3286e0f40162fc577daed02624cc/packages/next/src/index.config.ts
[config-globs]: https://github.com/serwist/serwist/blob/55f2ab0bc20d3286e0f40162fc577daed02624cc/packages/next/src/lib/config/utils.ts
[turbo-globs]: https://github.com/serwist/serwist/blob/55f2ab0bc20d3286e0f40162fc577daed02624cc/packages/turbo/src/lib/utils.ts
[size-limit]: https://serwist.pages.dev/docs/next/configuring/maximum-file-size-to-cache-in-bytes
[workbox]: https://developer.chrome.com/docs/workbox/modules/workbox-precaching
[sw-update]: https://w3c.github.io/ServiceWorker/#update-algorithm
[sw-install]: https://w3c.github.io/ServiceWorker/#installation-algorithm
[sw-security]: https://w3c.github.io/ServiceWorker/#security-considerations
[sw-path]: https://w3c.github.io/ServiceWorker/#path-restriction
[sw-cache]: https://w3c.github.io/ServiceWorker/#cache-lifetimes
[secure-contexts]: https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy
