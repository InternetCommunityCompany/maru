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
        // Vite hashes asset filenames — match the whole emit folder so the
        // overlay content script can load fonts and Maru sprites from the
        // host page context (img src, @font-face url) regardless of
        // hash. WXT already adds the shadow-root CSS for us.
        matches: ["<all_urls>"],
        resources: ["assets/*"],
      },
    ],
  },
});
