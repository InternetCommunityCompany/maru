import type { QuoteUpdate, SessionKey } from "@/arbiter/types";

/**
 * A change observed by a `QuoteReducer` subscriber.
 *
 * `added` fires the first time a `sessionKey` is seen. `updated` fires when a
 * strictly-newer-`sequence` `QuoteUpdate` replaces an existing one — the
 * previous value is included so derived state (UI rows, animations) can
 * diff cleanly. `evicted` fires when a session is removed by TTL, carrying
 * the last value held for it.
 */
export type QuoteReducerChange =
  | { type: "added"; sessionKey: SessionKey; update: QuoteUpdate }
  | {
      type: "updated";
      sessionKey: SessionKey;
      update: QuoteUpdate;
      previous: QuoteUpdate;
    }
  | { type: "evicted"; sessionKey: SessionKey; update: QuoteUpdate };

/**
 * Subscriber callback. Invoked synchronously after the reducer's internal
 * state has been updated for the change.
 */
export type QuoteReducerListener = (change: QuoteReducerChange) => void;

/**
 * Handle returned by `createQuoteReducer`.
 *
 * `ingest` is the wire-side entry point — wire it to the `provideQuoteChannel`
 * handler. The remaining methods form the read / subscribe surface a UI
 * consumer (or any other observer) uses.
 */
export type QuoteReducer = {
  /**
   * Apply an incoming `QuoteUpdate` to the per-session map.
   *
   * Out-of-order updates (`sequence <= stored.sequence` for the same session)
   * are dropped silently and produce no `QuoteReducerChange`. Every accepted
   * update resets the per-session TTL timer.
   */
  ingest(update: QuoteUpdate): void;
  /** Current best for a session, or `undefined` if none is held. */
  get(sessionKey: SessionKey): QuoteUpdate | undefined;
  /**
   * Read-only snapshot of the map. The reducer returns a fresh copy on each
   * call; callers may iterate it freely without affecting reducer state.
   */
  snapshot(): ReadonlyMap<SessionKey, QuoteUpdate>;
  /**
   * Subscribe to `added` / `updated` / `evicted` changes. Returns an
   * unsubscribe function. Subscribers are invoked synchronously in
   * subscription order; a throwing listener does not interrupt delivery to
   * other listeners.
   */
  subscribe(listener: QuoteReducerListener): () => void;
  /**
   * Stop all TTL timers and clear internal state. Use during teardown to
   * avoid keeping the service worker alive on pending timers.
   */
  dispose(): void;
};

/**
 * Tunables for `createQuoteReducer`.
 *
 * Currently just `ttlMs`. Defaults to `DEFAULT_TTL_MS` (60 s) when omitted.
 */
export type QuoteReducerOptions = {
  /** Idle TTL (ms) before a session is evicted. Default `DEFAULT_TTL_MS`. */
  ttlMs?: number;
};
