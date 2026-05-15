import type { StoredTokenList } from "./types";

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
  },
);
