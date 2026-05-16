import type { TokenList } from "./token-index";

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

/**
 * Persisted token-list blob, mirrored to `storage.local` so it survives a
 * service-worker restart. Same `storage.defineItem` pattern as
 * `excludedSites` and `settings`.
 *
 * The fallback represents "never fetched yet" — `fetchedAt: 0` makes
 * {@link ensureTokenList} treat it as stale on the first read, triggering
 * an immediate refresh against the backend.
 */
export const tokenList = storage.defineItem<StoredTokenList>(
  "local:tokenList",
  {
    fallback: { data: { tokens: [] }, fetchedAt: 0 },
    version: 1,
  },
);
