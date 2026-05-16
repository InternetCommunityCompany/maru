import { BACKEND_URL } from "@/backend-url";
import { chainList } from "./chain-list-storage";
import { hydrateChainIndex } from "./chain-index";
import type { ChainList } from "./types";

/** 24 h matches the backend's `s-maxage` — one fetch/day per install steady state. */
export const CHAIN_LIST_TTL_MS = 24 * 60 * 60 * 1000;

/** Test seams. */
export type EnsureChainListOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/**
 * Background-only: refresh the stored chain list if stale, then hydrate the
 * in-memory index. Always hydrates from `storage.local` first so the lookup
 * map is warm after an SW restart. Network failures are non-fatal — the
 * stored copy stays in place and consumers skip rendering the chain badge
 * until the next successful refresh.
 *
 * Content scripts use {@link hydrateChainListFromStorage} instead, picking
 * up writes from here via `storage.watch`.
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
