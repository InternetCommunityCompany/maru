import { BACKEND_URL } from "@/backend-url";
import { hydrateTokenIndex } from "./token-index";
import { tokenList } from "./token-list-storage";
import type { TokenList } from "./types";

/**
 * How long a stored token list is considered fresh. After this, the next
 * {@link ensureTokenList} call refreshes from the backend.
 *
 * 24 h matches the backend's `s-maxage`, so the steady state is one
 * fetch/day per install.
 */
export const TOKEN_LIST_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Optional injection seam for tests.
 *
 * @internal
 */
export type EnsureTokenListOptions = {
  fetchImpl?: typeof fetch;
  /** Override `Date.now()` — used by tests with fake timers. */
  now?: () => number;
};

/**
 * Refresh the persisted token list from the backend if the stored copy is
 * stale, then hydrate the in-memory index.
 *
 * Always hydrates the index from `storage.local`, even when the stored
 * copy is fresh — that's the path that warms the lookup map after a
 * service-worker restart. The network fetch is skipped when the cache is
 * within {@link TOKEN_LIST_TTL_MS}.
 *
 * @remarks
 * Idempotent and safe to call concurrently — a second call while a fetch
 * is in flight just races on `storage.setValue`, with last-write-wins; the
 * data being raced over is identical so the outcome doesn't matter.
 *
 * Network failures are non-fatal: the stored copy stays in place and the
 * index is hydrated from whatever was already persisted (which on a fresh
 * install is the empty fallback — `getTokenInfo` returns `null` for
 * everything until the next successful refresh, and consumers render the
 * `Unknown` fallback in the meantime).
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
