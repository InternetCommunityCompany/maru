import { hydrateChainIndex } from "./chain-index";
import { chainList } from "./chain-list-storage";

/**
 * Content-script side of metadata: hydrate from `storage.local` and watch
 * for future writes from the background's `ensureChainList`. Returns after
 * the initial hydration.
 */
export async function hydrateChainListFromStorage(): Promise<void> {
  const stored = await chainList.getValue();
  hydrateChainIndex(stored.data);
  chainList.watch((next) => hydrateChainIndex(next.data));
}
