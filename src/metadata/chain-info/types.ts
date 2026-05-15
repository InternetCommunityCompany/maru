/**
 * One chain's metadata as exposed to consumers via {@link getChainInfo}.
 *
 * Mirrors the slimmed `/api/chainlist` payload trimmed to what MARU surfaces:
 * `name` and `shortName` feed the human label, `iconUrl` feeds the chain
 * badge on the alert overlay's `TokenChip` (and any other surface that wants
 * an icon).
 *
 * `iconUrl` is the *resolved* URL — `null` when upstream had no icon for the
 * chain. See {@link resolveIconUrl} for the URL-vs-slug logic.
 */
export type ChainInfo = {
  chainId: number;
  name: string;
  shortName: string;
  iconUrl: string | null;
};

/**
 * Backend response shape for `GET /api/chainlist`. Slim projection of the
 * upstream `chainlist.org/rpcs.json` carrying only the fields the extension
 * reads.
 *
 * `icon` is the upstream's raw field (URL or DefiLlama slug) — the index
 * resolves it to a concrete URL when hydrating.
 */
export type ChainList = {
  chains: ChainListEntry[];
};

/**
 * One chain's slimmed entry as it appears on the wire.
 *
 * The shape mirrors {@link ChainInfo} but keeps the raw `icon` field instead
 * of a pre-resolved URL — resolution lives client-side in {@link resolveIconUrl}
 * so the backend stays a pure proxy.
 */
export type ChainListEntry = {
  chainId: number;
  name: string;
  shortName: string;
  icon?: string;
};

/**
 * Persisted blob stored in `storage.local`.
 *
 * `data` is the raw backend payload kept verbatim. `fetchedAt` is the
 * epoch-ms timestamp of the most recent successful refresh — used by
 * {@link ensureChainList} to decide whether the cache is stale.
 */
export type StoredChainList = {
  data: ChainList;
  fetchedAt: number;
};
