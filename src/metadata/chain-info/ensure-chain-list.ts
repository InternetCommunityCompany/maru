import { BACKEND_URL } from "@/backend-url";
import { chainList } from "./chain-list-storage";
import { hydrateChainIndex } from "./chain-index";
import type { ChainList } from "./types";

/**
 * How long a stored chain list is considered fresh. After this, the next
 * {@link ensureChainList} call refreshes from the backend.
 *
 * 24 h matches the backend's `s-maxage`, so the steady state is one
 * fetch/day per install.
 */
export const CHAIN_LIST_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Optional injection seam for tests.
 *
 * @internal
 */
export type EnsureChainListOptions = {
  fetchImpl?: typeof fetch;
  /** Override `Date.now()` — used by tests with fake timers. */
  now?: () => number;
};

/**
 * Refresh the persisted chain list from the backend if the stored copy is
 * stale, then hydrate the in-memory index.
 *
 * **Background-only.** Content scripts call
 * {@link hydrateChainListFromStorage} instead — they pick up the result of
 * this function via `storage.watch`, so the network fetch fires exactly
 * once per install, not once per open tab.
 *
 * Always hydrates the index from `storage.local`, even when the stored copy
 * is fresh — that's the path that warms the lookup map after a service-worker
 * restart. The network fetch is skipped when the cache is within
 * {@link CHAIN_LIST_TTL_MS}.
 *
 * @remarks
 * Idempotent and safe to call concurrently — a second call while a fetch is
 * in flight just races on `storage.setValue`, with last-write-wins; the data
 * being raced over is identical so the outcome doesn't matter.
 *
 * Network failures are non-fatal: the stored copy stays in place and the
 * index is hydrated from whatever was already persisted (which on a fresh
 * install is the empty fallback — `getChainInfo` returns `null` for
 * everything until the next successful refresh, and consumers that need a
 * badge skip rendering it in the meantime).
 */
export async function ensureChainList(
  options: EnsureChainListOptions = {},
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  const stored = await chainList.getValue();
  const stale = now() - stored.fetchedAt > CHAIN_LIST_TTL_MS;

  if (!stale) {
    hydrateChainIndex(stored.data);
    return;
  }

  try {
    const response = await fetchImpl(`${BACKEND_URL}/api/chainlist`);
    if (!response.ok) {
      hydrateChainIndex(stored.data);
      return;
    }
    const data = (await response.json()) as ChainList;
    if (!Array.isArray(data.chains)) {
      hydrateChainIndex(stored.data);
      return;
    }
    await chainList.setValue({ data, fetchedAt: now() });
    hydrateChainIndex(data);
  } catch {
    // Non-fatal: keep whatever we already have. If this was a cold install,
    // the index stays empty until the next refresh attempt succeeds.
    hydrateChainIndex(stored.data);
  }
}
