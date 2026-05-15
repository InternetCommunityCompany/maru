/**
 * Base URL of the MARU backend.
 *
 * Picked from build mode:
 * - `wxt` (dev / `import.meta.env.COMMAND === "serve"`) → localhost so
 *   you can iterate against a backend running locally on port 3000.
 * - `wxt build` (prod) → the deployed instance.
 *
 * Override by editing this file when you need to flip — e.g. point a dev
 * build at the deployed backend to debug a prod-only issue, or vice versa.
 *
 * @remarks
 * The host must also be declared in `wxt.config.ts` under
 * `host_permissions` so the background service worker is allowed to
 * `fetch()` it. Keep both lists in sync.
 */
export const BACKEND_URL =
  import.meta.env.COMMAND === "serve"
    ? "http://localhost:3000"
    : "https://api.usemaru.com";
