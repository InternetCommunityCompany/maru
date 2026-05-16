import { defineConfig } from "wxt";

// Entrypoint names that exist only to power the DevTools panel. They depend
// on `browser.devtools.*` and are useless (and a leakage risk) in production
// builds, so we strip them from the bundle and from the manifest when the
// command isn't `serve`. WXT auto-derives `devtools_page` from the
// `devtools` entrypoint, so skipping the entry also drops the manifest
// field — no manual `devtools_page` is needed.
const DEVTOOLS_ENTRYPOINTS = new Set(["devtools", "devtools-panel"]);

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  hooks: {
    "entrypoints:resolved": (wxt, entrypoints) => {
      if (wxt.config.command === "serve") return;
      for (const entry of entrypoints) {
        if (DEVTOOLS_ENTRYPOINTS.has(entry.name)) {
          entry.skipped = true;
        }
      }
    },
  },
  manifest: {
    name: "MARU",
    description: "Best swap rates, automatically.",
    permissions: ["storage"],
    // Hosts the background service worker is allowed to `fetch()`. Keep in
    // sync with `BACKEND_URL` in `src/backend-url.ts` — dev points at
    // localhost, prod at api.usemaru.com.
    host_permissions: [
      "https://api.usemaru.com/*",
      "http://localhost:3000/*",
    ],
    action: {
      default_title: "MARU",
    },
    web_accessible_resources: [
      {
        // Fonts and mascot sprites are emitted from `public/` at fixed paths
        // and loaded from content scripts via `browser.runtime.getURL`.
        matches: ["<all_urls>"],
        resources: ["fonts/*", "maru/*"],
      },
    ],
  },
});
