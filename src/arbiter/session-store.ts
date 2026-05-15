import type {
  QuoteSession,
  SessionKey,
  SessionPartialKey,
} from "./types";

/**
 * Default idle TTL (ms) after which an inactive session is evicted.
 *
 * Long enough to span user think time on a quote page, short enough to bound
 * memory if a tab is left open and the dapp keeps polling unrelated
 * endpoints.
 */
export const DEFAULT_IDLE_TTL_MS = 5 * 60 * 1000;

export type SessionStoreOptions = {
  /** Override the idle TTL (ms). Defaults to `DEFAULT_IDLE_TTL_MS`. */
  idleTtlMs?: number;
  /** Time source — injected so unit tests can drive the clock without `vi.useFakeTimers()`. */
  now?: () => number;
};

/**
 * In-memory map from `SessionKey` to `QuoteSession`.
 *
 * Two evictions matter:
 * - Partial-key eviction on `openOrGet` closes the prior session for the
 *   same `(domain, chainIn, chainOut, tokenIn, tokenOut)` the moment the
 *   user types a new amount. Without it, churn in the amount field would
 *   leak sessions until the idle TTL fires.
 * - Idle eviction runs on every store access. Cheap because the store stays
 *   small in practice (one or two sessions per active quote page).
 *
 * `delete` clears the session's debounce timer so timers never fire against
 * an evicted session.
 */
export class SessionStore {
  private readonly sessions = new Map<SessionKey, QuoteSession>();
  private readonly idleTtlMs: number;
  private readonly now: () => number;

  constructor(options: SessionStoreOptions = {}) {
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Get the session for `key`, opening it if missing.
   *
   * Before opening, closes any existing session whose `partialKey` matches —
   * i.e. the same trade pair on the same domain but with a different
   * `amountIn`. Also sweeps idle sessions whose `lastActivity` is older than
   * the configured TTL.
   *
   * Returns `{ session, opened }` so the arbiter can branch on the first-
   * candidate path (immediate emission at the no-grounding tier).
   */
  openOrGet(
    key: SessionKey,
    partialKey: SessionPartialKey,
  ): { session: QuoteSession; opened: boolean } {
    this.sweepIdle();
    const existing = this.sessions.get(key);
    if (existing) {
      existing.lastActivity = this.now();
      return { session: existing, opened: false };
    }
    this.evictByPartialKey(partialKey);
    const now = this.now();
    const session: QuoteSession = {
      key,
      partialKey,
      openedAt: now,
      lastActivity: now,
      candidates: [],
      bestCandidateId: null,
      bestScore: -Infinity,
      sequence: 0,
      debounceHandle: null,
    };
    this.sessions.set(key, session);
    return { session, opened: true };
  }

  /** Lookup without opening. Returns `undefined` if the session has been evicted. */
  get(key: SessionKey): QuoteSession | undefined {
    return this.sessions.get(key);
  }

  /**
   * Delete `key` and clear its debounce timer if any.
   *
   * Idempotent — deleting a missing key is a no-op.
   */
  delete(key: SessionKey): void {
    const s = this.sessions.get(key);
    if (!s) return;
    if (s.debounceHandle !== null) {
      clearTimeout(s.debounceHandle);
      s.debounceHandle = null;
    }
    this.sessions.delete(key);
  }

  /** Number of live sessions. Intended for tests and diagnostics. */
  get size(): number {
    return this.sessions.size;
  }

  /** Iterate all live sessions. Intended for tests and diagnostics. */
  values(): IterableIterator<QuoteSession> {
    return this.sessions.values();
  }

  private evictByPartialKey(partialKey: SessionPartialKey): void {
    for (const [k, s] of this.sessions) {
      if (s.partialKey === partialKey) this.delete(k);
    }
  }

  private sweepIdle(): void {
    const cutoff = this.now() - this.idleTtlMs;
    for (const [k, s] of this.sessions) {
      if (s.lastActivity < cutoff) this.delete(k);
    }
  }
}
