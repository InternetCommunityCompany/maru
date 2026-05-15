import type { QuoteUpdate, SessionKey } from "@/arbiter/types";
import type { QuoteReducer } from "@/quote-reducer/types";
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

/** Options for `createComparisonOrchestrator`. */
export type ComparisonOrchestratorOptions = {
  /** Source of `added` / `updated` / `evicted` change events. */
  reducer: QuoteReducer;
  /** Wire-side fetcher — defaults to `fetchBestQuote` in production wiring. */
  fetchBestQuote: FetchBestQuote;
  /** Sink for `ComparisonSnapshot`s. The background wires this to `ComparisonChannel.emit`. */
  emit: (snapshot: ComparisonSnapshot) => void;
};

/** Handle returned by `createComparisonOrchestrator`. */
export type ComparisonOrchestrator = {
  /**
   * Tear down: unsubscribes from the reducer, cancels every in-flight fetch.
   *
   * Use during background-worker termination or in tests. After `dispose()`,
   * no further snapshots will be emitted.
   */
  dispose(): void;
};

type CacheEntry =
  | { status: "pending" }
  | { status: "ok"; quote: BestQuote }
  | { status: "no_opinion" }
  | { status: "failed" };

/**
 * Build a comparison orchestrator that translates reducer changes into
 * `ComparisonSnapshot`s on the comparison channel.
 *
 * @remarks
 * State machine, per `SessionKey`:
 *
 * - `added` → cache enters `pending`, kick off backend fetch with a
 *   per-session `AbortController`, emit a `pending` snapshot.
 * - `updated` with a cached entry → synchronously emit a snapshot derived
 *   from the cached entry against the new `QuoteUpdate`. No refetch (the
 *   backend's `QuoteRequest` is fully determined by the session key, so
 *   amount changes alone never change the response).
 * - `updated` without a cached entry (defensive — shouldn't happen if `added`
 *   always fires first) → treat as `added`.
 * - `evicted` → abort any in-flight fetch and drop the cache entry. No
 *   trailing snapshot — consumers can infer end-of-session from `update.sessionKey`.
 * - Fetch resolution → store outcome in cache and emit a fresh snapshot
 *   using the current best `QuoteUpdate` (or the original `update` if the
 *   session has been evicted, which we drop silently).
 *
 * Aborted fetches do NOT emit a `failed` snapshot — they're intentional
 * cancellation, not failure.
 */
export function createComparisonOrchestrator(
  options: ComparisonOrchestratorOptions,
): ComparisonOrchestrator {
  const cache = new Map<SessionKey, CacheEntry>();
  const controllers = new Map<SessionKey, AbortController>();

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

  const startFetch = (update: QuoteUpdate): void => {
    const sessionKey = update.sessionKey;
    cache.set(sessionKey, { status: "pending" });
    options.emit({ status: "pending", update });

    const controller = new AbortController();
    controllers.set(sessionKey, controller);

    void options
      .fetchBestQuote(buildRequest(update), { signal: controller.signal })
      .then((outcome) => {
        // The fetch may resolve after eviction — drop silently.
        if (controllers.get(sessionKey) !== controller) return;
        controllers.delete(sessionKey);
        if (outcome.status === "aborted") return;

        const entry: CacheEntry =
          outcome.status === "ok"
            ? { status: "ok", quote: outcome.quote }
            : outcome.status === "no_opinion"
              ? { status: "no_opinion" }
              : { status: "failed" };
        cache.set(sessionKey, entry);

        // Emit against the reducer's current best — the session may have
        // been refined since `added` fired.
        const current = options.reducer.get(sessionKey) ?? update;
        options.emit(snapshotFor(current, entry));
      })
      .catch(() => {
        // `fetchBestQuote` never throws — outcomes are always returned — but
        // belt-and-braces in case a custom `fetchImpl` injection misbehaves.
        if (controllers.get(sessionKey) !== controller) return;
        controllers.delete(sessionKey);
        cache.set(sessionKey, { status: "failed" });
        const current = options.reducer.get(sessionKey) ?? update;
        options.emit({ status: "failed", update: current });
      });
  };

  const unsubscribe = options.reducer.subscribe((change) => {
    if (change.type === "added") {
      startFetch(change.update);
      return;
    }

    if (change.type === "updated") {
      const entry = cache.get(change.sessionKey);
      if (entry === undefined) {
        // Defensive — reducer fired `updated` without a prior `added`.
        startFetch(change.update);
        return;
      }
      options.emit(snapshotFor(change.update, entry));
      return;
    }

    // `evicted`
    const controller = controllers.get(change.sessionKey);
    if (controller !== undefined) {
      controller.abort();
      controllers.delete(change.sessionKey);
    }
    cache.delete(change.sessionKey);
  });

  return {
    dispose() {
      unsubscribe();
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
      cache.clear();
    },
  };
}
