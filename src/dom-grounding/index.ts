import type { Candidate, GroundingProvider } from "@/arbiter/types";
import { matchAmounts } from "./match-amounts";
import { createDomObserver, type ObserverHandle } from "./observer";
import type { TokenMetaResolver } from "./types";

export type DomGroundingOptions = {
  /**
   * Synchronous token metadata accessor. Must be safely callable on the
   * matcher's hot path (no `await`). Wire to MAR-82's `getTokenInfoCached`
   * when that module lands.
   */
  resolveMeta: TokenMetaResolver;
  /** Override the observer debounce (ms). */
  debounceMs?: number;
};

/**
 * Public handle returned by {@link createDomGrounding}. The wiring layer
 * passes `groundCandidates` to `arbiter.setGroundingProvider`; `detach` is
 * called by the wiring layer when the arbiter signals a locked session.
 */
export type DomGroundingHandle = {
  /**
   * `GroundingProvider` for `arbiter.setGroundingProvider`. Projects the
   * matcher's `(boost, evidence)` map down to the plain `Map<id, number>`
   * the arbiter expects, dropping evidence at this boundary.
   */
  groundCandidates: GroundingProvider;
  /** Stop observing and free resources. Idempotent. */
  detach: () => void;
};

/**
 * Wire up DOM grounding: start a `MutationObserver`-backed snapshot of the
 * page text and expose a `GroundingProvider` the arbiter can plug into via
 * `setGroundingProvider`.
 *
 * @remarks
 * Returns `null` in environments without a DOM (Node-only tests) — callers
 * must check before passing to the arbiter. When returned, the matcher is
 * synchronous on every call and reads the most recent snapshot; the
 * snapshot is refreshed by the observer on a ~200 ms debounce.
 *
 * The arbiter's `GroundingProvider` signature is `Map<id, number>`. We
 * pre-warm the snapshot on construction so the first arbiter emission for
 * a session sees the rendered numbers; subsequent emissions read whatever
 * the observer has flushed since.
 */
export function createDomGrounding(
  options: DomGroundingOptions,
): DomGroundingHandle | null {
  const observer: ObserverHandle | null = createDomObserver({
    debounceMs: options.debounceMs,
  });
  if (!observer) return null;

  const groundCandidates: GroundingProvider = (
    candidates: Candidate[],
  ): Map<string, number> => {
    const debug = matchAmounts(
      candidates,
      observer.snapshot(),
      options.resolveMeta,
    );
    const boosts = new Map<string, number>();
    for (const [id, { boost }] of debug) boosts.set(id, boost);
    return boosts;
  };

  return {
    groundCandidates,
    detach: () => observer.detach(),
  };
}
