/**
 * Resolve a Vite-bundled asset path into a full extension URL.
 *
 * @remarks
 * Asset imports normally return a hashed path (e.g.
 * `/assets/idle-abc123.webp`), which the browser resolves against the host
 * document origin. That's fine inside extension pages, but breaks inside
 * content scripts where the origin is the host site — so we wrap the path
 * with `browser.runtime.getURL()` to produce an absolute
 * `chrome-extension://…` URL.
 *
 * In dev builds Vite may inline small assets as `data:` URLs instead of
 * emitting a file. Those URLs are already self-contained and must be
 * returned unchanged; passing them through `getURL()` would prepend the
 * extension origin and break them.
 */
export function resolveAssetUrl(path: string): string {
  if (/^(data|blob|https?|chrome-extension):/.test(path)) return path;
  return (browser.runtime.getURL as (p: string) => string)(path);
}
