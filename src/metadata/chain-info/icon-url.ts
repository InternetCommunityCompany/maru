/**
 * DefiLlama's chain-icon CDN. Slugs returned by `chainlist.org` map onto
 * `rsz_<slug>.jpg` on this host — same family as the upstream chain list.
 */
const LLAMA_ICON_BASE = "https://icons.llamao.fi/icons/chains/rsz_";

/**
 * Heuristic for "this looks like a URL the browser can render directly". Used
 * to distinguish full URLs (passed through unchanged) from DefiLlama slugs
 * (resolved to `icons.llamao.fi`). HTTP(S), IPFS, IPNS, and data-URIs all
 * round-trip; anything else is treated as a slug.
 */
const URL_PREFIXES = ["http://", "https://", "ipfs://", "ipns://", "data:"];

/**
 * Resolve an upstream `icon` field to a concrete URL.
 *
 * Upstream entries carry one of three shapes:
 * - A full URL (IPFS gateway link, project CDN). Returned as-is.
 * - A slug (`"ethereum"`, `"arbitrum"`, `"polygon"`). Resolved to
 *   `https://icons.llamao.fi/icons/chains/rsz_<slug>.jpg`.
 * - `undefined` / empty. Returned as `null` — the alert overlay treats this
 *   as "render no badge".
 */
export function resolveIconUrl(icon: string | undefined): string | null {
  if (!icon) return null;
  const trimmed = icon.trim();
  if (trimmed.length === 0) return null;
  for (const prefix of URL_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(prefix)) return trimmed;
  }
  return `${LLAMA_ICON_BASE}${trimmed}.jpg`;
}
