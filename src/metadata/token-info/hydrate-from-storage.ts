import { hydrateTokenIndex } from "./token-index";
import { tokenList } from "./token-list-storage";

/**
 * Hydrate the content-script's in-memory token index from `storage.local`
 * and subscribe to future updates.
 *
 * @remarks
 * Content scripts call this instead of {@link ensureTokenList} so the
 * network refresh happens exactly once per install (in the background SW),
 * not once per open tab. Future writes from the background propagate to
 * every tab via the `storage.watch` subscription set up here.
 *
 * Returns once the initial hydration completes. Safe to call concurrently
 * with itself — the storage read is idempotent and `hydrateTokenIndex` is
 * a destructive replace.
 */
export async function hydrateTokenListFromStorage(): Promise<void> {
  const stored = await tokenList.getValue();
  hydrateTokenIndex(stored.data);
  tokenList.watch((next) => hydrateTokenIndex(next.data));
}
