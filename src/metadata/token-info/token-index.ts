/**
 * One token's metadata as exposed to consumers via {@link getTokenInfo}.
 *
 * Mirrors a Tokenlists.org entry trimmed to the fields MARU surfaces:
 * `decimals` drives the DOM-grounding formatter, `symbol` / `name` /
 * `logoURI` feed the extension UI surfaces (overlay, popup, history).
 *
 * `address` is preserved in its original casing from the upstream list so
 * UIs that link out to a block explorer can pass it through verbatim.
 * Lookups are case-insensitive — see {@link getTokenInfo}.
 */
export type TokenInfo = {
  chainId: number;
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoURI?: string;
};

/**
 * Backend response shape for `GET /api/tokenlist`. Tokenlists.org-format
 * payload trimmed to the fields the extension reads — the rest passes
 * through unobserved.
 */
export type TokenList = {
  tokens: TokenInfo[];
};

/**
 * In-memory `Map<chainId:address, TokenInfo>` the lookup hot path reads
 * from. Keys are `${chainId}:${address.toLowerCase()}` so callers don't
 * have to think about checksum casing.
 *
 * The map is module-singleton on purpose: there's exactly one cache per
 * service-worker process, hydrated once on SW boot and re-hydrated whenever
 * {@link ensureTokenList} successfully refreshes.
 */
const index = new Map<string, TokenInfo>();

/** Stable key used by both the index and the lookup. */
export function tokenKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

/**
 * Replace the index contents with `list.tokens`.
 *
 * Called on SW boot (right after reading the persisted blob) and on every
 * successful refresh inside {@link ensureTokenList}. The swap is
 * destructive — entries removed from the upstream list disappear from
 * lookups on the next hydration.
 */
export function hydrateTokenIndex(list: TokenList): void {
  index.clear();
  for (const entry of list.tokens) {
    index.set(tokenKey(entry.chainId, entry.address), entry);
  }
}

/**
 * Read-only accessor for {@link getTokenInfo}. Kept internal so callers
 * can't mutate the map out from under the lookup.
 */
export function lookupToken(chainId: number, address: string): TokenInfo | null {
  return index.get(tokenKey(chainId, address)) ?? null;
}

/**
 * Test-only handle for asserting on hydration without exposing the map.
 *
 * @internal
 */
export function tokenIndexSize(): number {
  return index.size;
}
