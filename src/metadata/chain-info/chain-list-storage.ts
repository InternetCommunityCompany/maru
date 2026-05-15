import type { StoredChainList } from "./types";

/**
 * Persisted chain-list blob, mirrored to `storage.local` so it survives a
 * service-worker restart. Same `storage.defineItem` pattern as the sibling
 * `tokenList`.
 *
 * The fallback represents "never fetched yet" — `fetchedAt: 0` makes
 * {@link ensureChainList} treat it as stale on the first read, triggering an
 * immediate refresh against the backend.
 */
export const chainList = storage.defineItem<StoredChainList>(
  "local:chainList",
  {
    fallback: { data: { chains: [] }, fetchedAt: 0 },
    version: 1,
  },
);
