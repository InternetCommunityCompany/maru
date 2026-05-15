import { resolveIconUrl } from "./icon-url";
import type { ChainInfo, ChainList } from "./types";

/**
 * In-memory `Map<chainId, ChainInfo>` the lookup hot path reads from.
 *
 * The map is module-singleton on purpose: there's exactly one cache per
 * service-worker process, hydrated once on SW boot and re-hydrated whenever
 * {@link ensureChainList} successfully refreshes.
 */
const index = new Map<number, ChainInfo>();

/**
 * Replace the index contents with `list.chains`.
 *
 * Called on SW boot (right after reading the persisted blob) and on every
 * successful refresh inside {@link ensureChainList}. Resolves the upstream
 * `icon` field to a concrete URL once at hydration time so the lookup hot
 * path doesn't repeat that work on every read.
 *
 * The swap is destructive — entries removed from the upstream list disappear
 * from lookups on the next hydration.
 */
export function hydrateChainIndex(list: ChainList): void {
  index.clear();
  for (const entry of list.chains) {
    index.set(entry.chainId, {
      chainId: entry.chainId,
      name: entry.name,
      shortName: entry.shortName,
      iconUrl: resolveIconUrl(entry.icon),
    });
  }
}

/**
 * Read-only accessor for {@link getChainInfo}. Kept internal so callers can't
 * mutate the map out from under the lookup.
 */
export function lookupChain(chainId: number): ChainInfo | null {
  return index.get(chainId) ?? null;
}

/**
 * Test-only handle for asserting on hydration without exposing the map.
 *
 * @internal
 */
export function chainIndexSize(): number {
  return index.size;
}
