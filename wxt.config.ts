import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "MARU",
    description: "Best swap rates, automatically.",
    permissions: ["storage"],
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
