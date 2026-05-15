import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  // WXT's plugin registers the auto-imports (`storage`, `browser`, …) and
  // wires up `fakeBrowser` so storage-backed modules can be unit tested
  // without spinning up a real extension host.
  plugins: [WxtVitest()],
  resolve: {
    alias: {
      "@": src,
      "~": src,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
