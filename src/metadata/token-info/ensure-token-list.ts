import { BACKEND_URL } from "@/backend-url";
import { hydrateTokenIndex } from "./token-index";
import { tokenList } from "./token-list-storage";
import type { TokenList } from "./token-index";

/** 24 h matches the backend's `s-maxage` — one fetch/day per install steady state. */
export const TOKEN_LIST_TTL_MS = 24 * 60 * 60 * 1000;

/** Test seams. */
export type EnsureTokenListOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/**
 * Background-only: refresh the stored token list if stale, then hydrate the
 * in-memory index. Always hydrates from `storage.local` first so the lookup
 * map is warm after an SW restart. Network failures are non-fatal — the
 * stored copy stays in place and consumers render the `Unknown` fallback
 * until the next successful refresh.
 *
 * Content scripts use {@link hydrateTokenListFromStorage} instead, picking
 * up writes from here via `storage.watch`.
 */
export async function ensureTokenList(
  options: EnsureTokenListOptions = {},
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  const stored = await tokenList.getValue();
  const stale = now() - stored.fetchedAt > TOKEN_LIST_TTL_MS;

  if (!stale) {
    hydrateTokenIndex(stored.data);
    return;
  }

  try {
    const response = await fetchImpl(`${BACKEND_URL}/api/tokenlist`);
    if (!response.ok) {
      hydrateTokenIndex(stored.data);
      return;
    }
    const data = (await response.json()) as TokenList;
    if (!Array.isArray(data.tokens)) {
      hydrateTokenIndex(stored.data);
      return;
    }
    await tokenList.setValue({ data, fetchedAt: now() });
    hydrateTokenIndex(data);
  } catch {
    // Non-fatal: keep whatever we already have. If this was a cold install,
    // the index stays empty until the next refresh attempt succeeds.
    hydrateTokenIndex(stored.data);
  }
}
