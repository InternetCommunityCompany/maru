import { hydrateTokenIndex } from "./token-index";
import { tokenList } from "./token-list-storage";

/**
 * Content-script side of metadata: hydrate from `storage.local` and watch
 * for future writes from the background's `ensureTokenList`. Returns after
 * the initial hydration.
 */
export async function hydrateTokenListFromStorage(): Promise<void> {
  const stored = await tokenList.getValue();
  hydrateTokenIndex(stored.data);
  tokenList.watch((next) => hydrateTokenIndex(next.data));
}
