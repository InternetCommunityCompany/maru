import type { InterceptedEvent } from "@/interceptors/types";
import type { SwapEvent } from "@/template-engine/types";
import { score as defaultScore } from "./scorer";
import { partialSessionKey, sessionKey } from "./session-key";
import { SessionStore } from "./session-store";
import type {
  Candidate,
  GroundingProvider,
  QuoteSession,
  QuoteUpdate,
} from "./types";
import { CONFIDENCE } from "./types";

/**
 * Default debounce window (ms) for the emit-then-refine cadence.
 *
 * Picked from the 250–400 ms range called out in MAR-78. 300 ms is long
 * enough to gather a 3-aggregator parallel fan-out and short enough that the
 * consumer doesn't perceive a stall.
 */
export const DEFAULT_DEBOUNCE_MS = 300;

export type ArbiterOptions = {
  /** Sink for `QuoteUpdate`s. The current best of each session is emitted here. */
  emit: (update: QuoteUpdate) => void;
  /** Override the emit-then-refine debounce window (ms). */
  debounceMs?: number;
  /** Inject a pre-constructed session store (mostly for tests). */
  store?: SessionStore;
  /** Time source — inject for deterministic tests. */
  now?: () => number;
  /** Override the scorer — inject for deterministic tests. */
  score?: (
    candidate: Candidate,
    session: QuoteSession,
    boost: number,
  ) => number;
};

/**
 * Arbiter handle. Returned by `createArbiter`.
 *
 * Surface is intentionally narrow: `ingest` is the hot path; everything else
 * is wiring or test-time access.
 */
export type Arbiter = {
  /**
   * Add a candidate to the appropriate session. Opens the session if missing.
   *
   * Emits synchronously on first-candidate (so the consumer has *something*
   * fast); subsequent candidates only emit if they outscore the current
   * best, and that emission is debounced by `debounceMs`.
   */
  ingest: (swap: SwapEvent, raw: InterceptedEvent) => void;
  /**
   * Swap in a `GroundingProvider`. The DOM grounding child issue calls this
   * once at startup. The default provider returns an empty `Map`, so the
   * arbiter emits at the no-grounding tier until a real provider is wired
   * in.
   */
  setGroundingProvider: (provider: GroundingProvider) => void;
  /** Test helper: look up the live session a given swap belongs to. */
  sessionFor: (swap: SwapEvent) => QuoteSession | undefined;
};

const candidateIdOf = (raw: InterceptedEvent, swap: SwapEvent): string =>
  `${raw.id}:${raw.phase}:${swap.templateId}:${swap.amountOut}`;

const urlOf = (raw: InterceptedEvent): string | undefined =>
  raw.source === "ethereum" ? undefined : raw.url;

const initialConfidence = (templateId: string): number =>
  templateId === "heuristic" ? CONFIDENCE.heuristic : CONFIDENCE.template;

/**
 * Creates an arbiter that holds detection candidates per quote session,
 * scores them, debounces, and emits a single current best per session via
 * `options.emit`.
 *
 * @remarks
 * Contract recap (full version in MAR-78):
 *
 * - `ingest` is the only entry point on the hot path; engines pass each
 *   `SwapEvent` candidate together with the originating `InterceptedEvent`
 *   so the arbiter can attach ingest-site metadata without polluting the
 *   engines.
 * - The first candidate in a new session emits immediately at the no-
 *   grounding confidence tier for its provenance (`heuristic` 0.3,
 *   `template` 0.6). Later candidates within the debounce window replace
 *   the emission only if they outscore the current best.
 * - Sessions are evicted when the user types a new amount on the same trade
 *   pair (`SessionStore.openOrGet` does the partial-key eviction).
 * - The grounding provider can be swapped via `setGroundingProvider`; the
 *   default provider returns an empty `Map` (zero boost), so the arbiter
 *   keeps emitting at the no-grounding tier — silent failure isn't an
 *   option even when DOM grounding has nothing to say.
 */
export function createArbiter(options: ArbiterOptions): Arbiter {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const store = options.store ?? new SessionStore({ now: options.now });
  const now = options.now ?? (() => Date.now());
  const scoreFn = options.score ?? defaultScore;
  let groundingProvider: GroundingProvider = () => new Map();

  const emitBest = (session: QuoteSession): void => {
    const best = session.candidates.find(
      (c) => c.id === session.bestCandidateId,
    );
    if (!best) return;
    const boosts = groundingProvider(session.candidates);
    const boost = boosts.get(best.id) ?? 0;
    session.sequence += 1;
    const confidence =
      boost > 0 ? CONFIDENCE.grounded : initialConfidence(best.swap.templateId);
    options.emit({
      swap: best.swap,
      sessionKey: session.key,
      sequence: session.sequence,
      confidence,
      candidateId: best.id,
    });
  };

  return {
    ingest(swap, raw) {
      const key = sessionKey(swap);
      const partial = partialSessionKey(swap);
      const { session, opened } = store.openOrGet(key, partial);

      const candidate: Candidate = {
        id: candidateIdOf(raw, swap),
        swap,
        interceptedId: raw.id,
        phase: raw.phase,
        source: raw.source,
        url: urlOf(raw),
        ingestedAt: now(),
      };

      const boosts = groundingProvider([...session.candidates, candidate]);
      const boost = boosts.get(candidate.id) ?? 0;
      const candidateScore = scoreFn(candidate, session, boost);

      session.candidates.push(candidate);
      session.lastActivity = now();

      const outscored = candidateScore > session.bestScore;
      if (outscored) {
        session.bestCandidateId = candidate.id;
        session.bestScore = candidateScore;
      }

      if (opened) {
        // First candidate in a fresh session — emit immediately at the
        // no-grounding tier. Subsequent ingests inside the debounce window
        // will only replace the emission if they outscore.
        emitBest(session);
        return;
      }

      if (!outscored) return;

      // Reset the debounced refine window. The new best wins after the
      // window unless a higher-scoring candidate arrives in the meantime.
      if (session.debounceHandle !== null) {
        clearTimeout(session.debounceHandle);
      }
      session.debounceHandle = setTimeout(() => {
        session.debounceHandle = null;
        const live = store.get(key);
        if (live) emitBest(live);
      }, debounceMs);
    },

    setGroundingProvider(provider) {
      groundingProvider = provider;
    },

    sessionFor(swap) {
      return store.get(sessionKey(swap));
    },
  };
}
