import { recordTrace } from "@/debug/debug-bus";
import type { InterceptedEvent } from "@/interceptors/install-interceptors";
import type { SwapEvent } from "@/template-engine/build-swap-event";
import { score as defaultScore } from "./scorer";
import { partialSessionKey, sessionKey } from "./session-key";
import { SessionStore } from "./session-store";
import type {
  Candidate,
  GroundingProvider,
  QuoteSession,
  QuoteUpdate,
  ScoreBreakdown,
} from "./types";
import { CONFIDENCE } from "./types";

/** Emit-then-refine debounce window. 300ms covers a 3-aggregator fan-out. */
export const DEFAULT_DEBOUNCE_MS = 300;

export type ArbiterOptions = {
  emit: (update: QuoteUpdate) => void;
  debounceMs?: number;
  /** Pre-constructed session store; tests use this. */
  store?: SessionStore;
  /** Time source for deterministic tests. */
  now?: () => number;
  score?: (candidate: Candidate, boost: number) => ScoreBreakdown;
};

export type Arbiter = {
  /**
   * Add a candidate to the appropriate session, opening one if needed. Emits
   * synchronously on the first candidate; later candidates within the
   * debounce window replace the emission only if they outscore the current
   * best.
   */
  ingest: (swap: SwapEvent, raw: InterceptedEvent) => void;
  /** Default provider returns an empty `Map` until DOM grounding is wired. */
  setGroundingProvider: (provider: GroundingProvider) => void;
  /** Test helper. */
  sessionFor: (swap: SwapEvent) => QuoteSession | undefined;
};

const candidateIdOf = (raw: InterceptedEvent, swap: SwapEvent): string =>
  `${raw.id}:${raw.phase}:${swap.templateId}:${swap.amountOut}`;

const urlOf = (raw: InterceptedEvent): string | undefined =>
  raw.source === "ethereum" ? undefined : raw.url;

const initialConfidence = (templateId: string): number =>
  templateId === "heuristic" ? CONFIDENCE.heuristic : CONFIDENCE.template;

/**
 * Holds detection candidates per quote session, scores them, debounces, and
 * emits the current best via `options.emit`. Sessions are evicted on a
 * partial-key match when the user types a new amount on the same trade pair
 * (see `SessionStore.openOrGet`).
 */
export function createArbiter(options: ArbiterOptions): Arbiter {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const store = options.store ?? new SessionStore({ now: options.now });
  const now = options.now ?? (() => Date.now());
  const scoreFn = options.score ?? defaultScore;
  let groundingProvider: GroundingProvider = () => new Map();

  const emitBest = (
    session: QuoteSession,
    precomputedBoosts?: Map<string, number>,
  ): void => {
    const best = session.candidates.find(
      (c) => c.id === session.bestCandidateId,
    );
    if (!best) return;
    // `ingest` computes boosts for scoring the new candidate; on its synchronous
    // first-emit path it forwards them here so we don't walk the DOM again.
    // The debounced refine path passes nothing — by then the DOM may have moved
    // and a fresh scan is wanted.
    const boosts = precomputedBoosts ?? groundingProvider(session.candidates);
    const boost = boosts.get(best.id) ?? 0;
    session.sequence += 1;
    const confidence =
      boost > 0 ? CONFIDENCE.grounded : initialConfidence(best.swap.templateId);
    const update: QuoteUpdate = {
      swap: best.swap,
      sessionKey: session.key,
      sequence: session.sequence,
      confidence,
      candidateId: best.id,
    };
    options.emit(update);
    recordTrace({
      kind: "quote_emitted",
      at: now(),
      sessionKey: session.key,
      sequence: session.sequence,
      candidateId: best.id,
      confidence,
    });
  };

  return {
    ingest(swap, raw) {
      const key = sessionKey(swap);
      const partial = partialSessionKey(swap);
      const { session, opened } = store.openOrGet(key, partial);

      if (opened) {
        recordTrace({
          kind: "session_opened",
          at: now(),
          sessionKey: key,
          domain: swap.domain,
          partialKey: partial,
        });
      }

      const candidate: Candidate = {
        id: candidateIdOf(raw, swap),
        swap,
        interceptedId: raw.id,
        phase: raw.phase,
        source: raw.source,
        url: urlOf(raw),
        ingestedAt: now(),
      };

      recordTrace({
        kind: "candidate_added",
        at: candidate.ingestedAt,
        sessionKey: key,
        candidateId: candidate.id,
        phase: candidate.phase,
        source: candidate.source,
        templateId: swap.templateId,
      });

      const boosts = groundingProvider([...session.candidates, candidate]);
      const boost = boosts.get(candidate.id) ?? 0;
      const breakdown = scoreFn(candidate, boost);
      const candidateScore = breakdown.total;
      recordTrace({
        kind: "score_breakdown",
        at: now(),
        sessionKey: key,
        candidateId: candidate.id,
        breakdown,
      });

      session.candidates.push(candidate);
      session.lastActivity = now();

      const outscored = candidateScore > session.bestScore;
      if (outscored) {
        const previousId = session.bestCandidateId;
        session.bestCandidateId = candidate.id;
        session.bestScore = candidateScore;
        recordTrace({
          kind: "best_changed",
          at: now(),
          sessionKey: key,
          previousId,
          nextId: candidate.id,
          score: candidateScore,
        });
      }

      if (opened) {
        // First candidate in a fresh session — emit immediately at the
        // no-grounding tier. Subsequent ingests inside the debounce window
        // will only replace the emission if they outscore.
        emitBest(session, boosts);
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
