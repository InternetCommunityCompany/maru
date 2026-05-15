import type { TokenInfo, TokenList } from "./types";

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
