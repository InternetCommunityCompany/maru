import type { QuoteUpdate, SessionKey } from "@/arbiter/types";
import { compareQuotes } from "./compare-quotes";
import type {
  FetchBestQuoteOptions,
  FetchBestQuoteOutcome,
} from "./fetch-best-quote";
import type { BestQuote, ComparisonSnapshot, QuoteRequest } from "./types";

export type FetchBestQuote = (
  req: QuoteRequest,
  options?: FetchBestQuoteOptions,
) => Promise<FetchBestQuoteOutcome>;

/** Idle session TTL — generous so a user reading the overlay doesn't lose state. */
export const DEFAULT_SESSION_TTL_MS = 60_000;

export type ComparisonOrchestratorOptions = {
  fetchBestQuote: FetchBestQuote;
  /** Idle TTL (ms). Defaults to {@link DEFAULT_SESSION_TTL_MS}. */
  ttlMs?: number;
};

export type ComparisonSnapshotListener = (snapshot: ComparisonSnapshot) => void;

export type ComparisonOrchestrator = {
  /**
   * Apply an incoming `QuoteUpdate`. Updates whose `sequence` isn't strictly
   * greater than the stored one are dropped silently. Accepted updates reset
   * the per-session TTL timer.
   */
  ingest(update: QuoteUpdate): void;
  /** Each port wires its own listener and tears it down on `port.onDisconnect`. */
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
 * Owns per-session state and translates `QuoteUpdate`s into `ComparisonSnapshot`s.
 *
 * One fetch fires per session (first ingest). Subsequent updates within the
 * session re-emit a snapshot against the cached fetch outcome without
 * refetching — the backend `QuoteRequest` is fully determined by the session
 * key, so amount changes can't alter the response. TTL eviction aborts the
 * in-flight fetch and emits no trailing snapshot. Aborted fetch resolutions
 * are dropped silently — not surfaced as `failed`.
 */
export function createComparisonOrchestrator(
  options: ComparisonOrchestratorOptions,
): ComparisonOrchestrator {
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const sessions = new Map<SessionKey, Session>();
  const listeners = new Set<ComparisonSnapshotListener>();

  const emit = (snapshot: ComparisonSnapshot): void => {
    // Iterate a copy so a listener unsubscribing mid-fanout doesn't skip a sibling.
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
    if (entry.status === "ok") {
      return {
        status: "ok",
        update,
        comparison: compareQuotes(update.swap, entry.quote),
      };
    }
    return { status: entry.status, update };
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
        // Session evicted or replaced by a later fetch — drop silently.
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

      if (update.sequence <= existing.update.sequence) return;

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
