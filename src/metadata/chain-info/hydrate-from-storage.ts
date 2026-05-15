import { hydrateChainIndex } from "./chain-index";
import { chainList } from "./chain-list-storage";

/**
 * Hydrate the content-script's in-memory chain index from `storage.local`
 * and subscribe to future updates.
 *
 * @remarks
 * Content scripts call this instead of {@link ensureChainList} so the
 * network refresh happens exactly once per install (in the background SW),
 * not once per open tab. Future writes from the background propagate to
 * every tab via the `storage.watch` subscription set up here.
 *
 * Returns once the initial hydration completes. Safe to call concurrently
 * with itself — the storage read is idempotent and `hydrateChainIndex` is
 * a destructive replace.
 */
export async function hydrateChainListFromStorage(): Promise<void> {
  const stored = await chainList.getValue();
  hydrateChainIndex(stored.data);
  chainList.watch((next) => hydrateChainIndex(next.data));
}
