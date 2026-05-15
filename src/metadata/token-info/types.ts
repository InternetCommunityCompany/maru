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
 * Persisted blob stored in `storage.local`.
 *
 * `data` is the raw backend payload kept verbatim (so a future schema
 * version on the wire stays inspectable). `fetchedAt` is the epoch-ms
 * timestamp of the most recent successful refresh — used by
 * {@link ensureTokenList} to decide whether the cache is stale.
 */
export type StoredTokenList = {
  data: TokenList;
  fetchedAt: number;
};
