import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
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
