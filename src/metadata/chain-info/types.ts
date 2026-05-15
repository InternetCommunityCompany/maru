/**
 * One chain's metadata as exposed to consumers via {@link getChainInfo}.
 *
 * Mirrors the slimmed `/api/chainlist` payload trimmed to what MARU surfaces:
 * `name` and `shortName` feed the human label, `iconUrl` feeds the chain
 * badge on the alert overlay's `TokenChip` (and any other surface that wants
 * an icon).
 *
 * `iconUrl` is the resolved URL the backend ships — `null` when upstream had
 * no icon for the chain. The extension renders it as-is; the backend handles
 * the URL-vs-slug rewriting.
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
 * reads, with the icon already resolved to a renderable URL.
 */
export type ChainList = {
  chains: ChainListEntry[];
};

/**
 * One chain's slimmed entry as it appears on the wire.
 *
 * Identical shape to {@link ChainInfo} — the backend is the authority on
 * icon URL resolution, so the entry needs no further rewriting client-side.
 */
export type ChainListEntry = {
  chainId: number;
  name: string;
  shortName: string;
  iconUrl: string | null;
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
