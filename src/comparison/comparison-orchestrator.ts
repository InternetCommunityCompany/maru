import type { QuoteUpdate, SessionKey } from "@/arbiter/types";
import { compareQuotes } from "./compare-quotes";
import type {
  FetchBestQuoteOptions,
  FetchBestQuoteOutcome,
} from "./fetch-best-quote";
import type { BestQuote, ComparisonSnapshot, QuoteRequest } from "./types";

/** Function signature of `fetchBestQuote`, injectable for tests. */
export type FetchBestQuote = (
  req: QuoteRequest,
  options?: FetchBestQuoteOptions,
) => Promise<FetchBestQuoteOutcome>;

/**
 * Default idle TTL — a session whose last ingest is older than this is
 * evicted: in-flight fetch aborted, cache entry dropped.
 *
 * Generous on purpose: aggregator UIs can sit idle for a while between
 * refreshes and we don't want to drop the user's last visible comparison
 * mid-read.
 */
export const DEFAULT_SESSION_TTL_MS = 60_000;

/** Options for `createComparisonOrchestrator`. */
export type ComparisonOrchestratorOptions = {
  /** Wire-side fetcher — defaults to `fetchBestQuote` in production wiring. */
  fetchBestQuote: FetchBestQuote;
  /** Idle TTL (ms) override. Defaults to {@link DEFAULT_SESSION_TTL_MS}. */
  ttlMs?: number;
};

/** Sink for `ComparisonSnapshot`s — one of these per active content-script port. */
export type ComparisonSnapshotListener = (snapshot: ComparisonSnapshot) => void;

/** Handle returned by `createComparisonOrchestrator`. */
export type ComparisonOrchestrator = {
  /**
   * Apply an incoming `QuoteUpdate`. Out-of-order updates (sequence not
   * strictly greater than the stored one for the same session) are dropped
   * silently. Every accepted update resets the per-session TTL timer.
   *
   * Wired into the background's `onQuote` port handler.
   */
  ingest(update: QuoteUpdate): void;
  /**
   * Subscribe a listener to receive every emitted `ComparisonSnapshot`. The
   * returned function detaches the listener; safe to call multiple times.
   * Each connected port wires its own listener and tears it down on
   * `port.onDisconnect` so background→content traffic stays point-cast.
   */
  subscribe(listener: ComparisonSnapshotListener): () => void;
};

type CacheEntry =
  | { status: "pending" }
  | { status: "ok"; quote: BestQuote }
  | { status: "no_opinion" }
  | { status: "failed" };

type Session = {
  update: QuoteUpdate;
  cache: CacheEntry;
  controller: AbortController | null;
  ttlHandle: ReturnType<typeof setTimeout>;
};

/**
 * Build a comparison orchestrator that owns per-session state and translates
 * `QuoteUpdate`s on the quote channel into `ComparisonSnapshot`s on the
 * comparison channel.
 *
 * @remarks
 * State machine per `SessionKey`:
 *
 * - **First update** → cache enters `pending`, fetch starts under a per-session
 *   `AbortController`, a `pending` snapshot is emitted, the TTL timer is armed.
 * - **Subsequent update, stale sequence** → dropped silently.
 * - **Subsequent update, new sequence** → emit a snapshot derived from the
 *   cached entry against the new `QuoteUpdate` (no refetch — the backend's
 *   `QuoteRequest` is fully determined by the session key, so amount changes
 *   alone never change the response). TTL timer is reset.
 * - **TTL elapsed** → abort in-flight fetch, drop cache entry, no trailing
 *   snapshot. Consumers can infer end-of-session from gaps in `update.sequence`.
 * - **Fetch resolution** → store outcome in cache, emit a fresh snapshot using
 *   the current best `QuoteUpdate` (or drop silently if the session has been
 *   evicted in the meantime).
 *
 * Aborted fetches do NOT emit a `failed` snapshot — they're intentional
 * cancellation.
 */
export function createComparisonOrchestrator(
  options: ComparisonOrchestratorOptions,
): ComparisonOrchestrator {
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const sessions = new Map<SessionKey, Session>();
  const listeners = new Set<ComparisonSnapshotListener>();

  const emit = (snapshot: ComparisonSnapshot): void => {
    // Iterate a copy so a listener unsubscribing mid-fanout (e.g. its port
    // just dropped) doesn't skip a sibling.
    for (const listener of [...listeners]) listener(snapshot);
  };

  const buildRequest = (update: QuoteUpdate): QuoteRequest => {
    const { swap } = update;
    return {
      chainIn: swap.chainIn,
      chainOut: swap.chainOut,
      tokenIn: swap.tokenIn.toLowerCase(),
      tokenOut: swap.tokenOut.toLowerCase(),
      amount: swap.amountIn,
      kind: "exact_in",
    };
  };

  const snapshotFor = (
    update: QuoteUpdate,
    entry: CacheEntry,
  ): ComparisonSnapshot => {
    switch (entry.status) {
      case "pending":
        return { status: "pending", update };
      case "no_opinion":
        return { status: "no_opinion", update };
      case "failed":
        return { status: "failed", update };
      case "ok":
        return {
          status: "result",
          update,
          comparison: compareQuotes(update.swap, entry.quote),
        };
    }
  };

  const evict = (sessionKey: SessionKey): void => {
    const session = sessions.get(sessionKey);
    if (!session) return;
    session.controller?.abort();
    clearTimeout(session.ttlHandle);
    sessions.delete(sessionKey);
  };

  const armTtl = (sessionKey: SessionKey): ReturnType<typeof setTimeout> =>
    setTimeout(() => evict(sessionKey), ttlMs);

  const startFetch = (update: QuoteUpdate): AbortController => {
    const controller = new AbortController();
    const sessionKey = update.sessionKey;

    void options
      .fetchBestQuote(buildRequest(update), { signal: controller.signal })
      .then((outcome) => {
        const session = sessions.get(sessionKey);
        // Session evicted, or replaced by a later fetch — drop silently.
        if (!session || session.controller !== controller) return;
        if (outcome.status === "aborted") return;

        const next: CacheEntry =
          outcome.status === "ok"
            ? { status: "ok", quote: outcome.quote }
            : outcome.status === "no_opinion"
              ? { status: "no_opinion" }
              : { status: "failed" };
        session.cache = next;
        session.controller = null;
        emit(snapshotFor(session.update, next));
      })
      .catch(() => {
        // `fetchBestQuote` returns outcomes rather than throwing — belt-and-
        // braces for misbehaving test doubles.
        const session = sessions.get(sessionKey);
        if (!session || session.controller !== controller) return;
        session.cache = { status: "failed" };
        session.controller = null;
        emit({ status: "failed", update: session.update });
      });

    return controller;
  };

  return {
    ingest(update) {
      const sessionKey = update.sessionKey;
      const existing = sessions.get(sessionKey);

      if (existing === undefined) {
        const controller = startFetch(update);
        sessions.set(sessionKey, {
          update,
          cache: { status: "pending" },
          controller,
          ttlHandle: armTtl(sessionKey),
        });
        emit({ status: "pending", update });
        return;
      }

      if (update.sequence <= existing.update.sequence) {
        // Out-of-order or duplicate — drop.
        return;
      }

      existing.update = update;
      clearTimeout(existing.ttlHandle);
      existing.ttlHandle = armTtl(sessionKey);
      emit(snapshotFor(update, existing.cache));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
