import type {
  QuoteSession,
  SessionKey,
  SessionPartialKey,
} from "./types";

/** Spans user think time; short enough to bound memory on idle dapp pages. */
export const DEFAULT_IDLE_TTL_MS = 5 * 60 * 1000;

export type SessionStoreOptions = {
  idleTtlMs?: number;
  /** Test seam. */
  now?: () => number;
};

/**
 * Per-arbiter `Map<SessionKey, QuoteSession>`. Two evictions:
 *
 * - **Partial-key** on `openOrGet` — closes the prior session for the same
 *   trade pair the moment the user types a new amount. Without this, amount
 *   churn would leak sessions until the idle TTL fires.
 * - **Idle** swept on every access. Cheap — store stays small in practice.
 *
 * `delete` clears the session's debounce timer so it can't fire post-eviction.
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
   * Get the session for `key`, opening one if missing. Closes any prior
   * session with the same `partialKey` (same trade pair, different amount)
   * and sweeps idle sessions. `opened` lets the arbiter branch on the
   * first-candidate path.
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

  get(key: SessionKey): QuoteSession | undefined {
    return this.sessions.get(key);
  }

  /** Idempotent. Clears any pending debounce timer so it can't fire post-eviction. */
  delete(key: SessionKey): void {
    const s = this.sessions.get(key);
    if (!s) return;
    if (s.debounceHandle !== null) {
      clearTimeout(s.debounceHandle);
      s.debounceHandle = null;
    }
    this.sessions.delete(key);
  }

  /** Test/diagnostics. */
  get size(): number {
    return this.sessions.size;
  }

  /** Test/diagnostics. */
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
