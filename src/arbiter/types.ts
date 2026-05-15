import type { InterceptedEvent } from "@/interceptors/types";
import type { SwapEvent } from "@/template-engine/types";

/**
 * Phase of the `InterceptedEvent` that produced a candidate.
 *
 * Mirrors `InterceptedEvent["phase"]` — captured at ingest time so the scorer
 * can prefer response-phase candidates over request-phase ones without
 * re-walking the source event.
 */
export type CandidatePhase = InterceptedEvent["phase"];

/**
 * A `SwapEvent` wrapped with the ingest-site metadata the arbiter and scorer
 * need but which the engines deliberately don't carry.
 *
 * Engines (`src/template-engine`, `src/heuristic`) stay pure `SwapEvent`
 * producers; this wrap happens at the arbiter ingest boundary in
 * `src/entrypoints/injected.content.ts`.
 */
export type Candidate = {
  /**
   * Stable per-candidate id. Derived from the intercepted event's id, its
   * phase, the producing template, and `amountOut` so two phases of the same
   * call (or two engines extracting different amounts from the same call)
   * don't collide.
   */
  id: string;
  /** The normalised swap the engine produced. */
  swap: SwapEvent;
  /** Id of the `InterceptedEvent` that produced this candidate (stable across request/response phases). */
  interceptedId: string;
  /** Phase of the `InterceptedEvent` that produced this candidate. */
  phase: CandidatePhase;
  /** Interceptor source — kept here so the scorer doesn't have to re-derive it from `transport`. */
  source: InterceptedEvent["source"];
  /** Request URL for `fetch`/`xhr` candidates; `undefined` for `ethereum`. */
  url?: string;
  /** Wall-clock timestamp (ms) at the arbiter ingest site. */
  ingestedAt: number;
};

/**
 * Stable per-session key.
 *
 * Built from `(domain, chainIn, chainOut, tokenIn, tokenOut, amountIn)` with
 * addresses lower-cased and `amountIn` normalised through `BigInt` so
 * `"1000"` and `"1000.0"` collapse onto the same session. Opaque to
 * consumers — produced and consumed only by `session-key.ts`.
 */
export type SessionKey = string;

/**
 * Eviction-only key — same as `SessionKey` but missing `amountIn`.
 *
 * `SessionStore` uses this to find and close any prior session for the same
 * trade pair when the user types a new amount. Without it, every keystroke
 * in the amount field would open a fresh session that the scorer would keep
 * holding alongside the live one.
 */
export type SessionPartialKey = string;

/**
 * In-flight aggregation for a single quote attempt.
 *
 * One session per `SessionKey`. The session accumulates candidates from any
 * number of detection engines, tracks the current best (by scorer output),
 * and carries the monotonic `sequence` consumers use to order emissions.
 */
export type QuoteSession = {
  key: SessionKey;
  partialKey: SessionPartialKey;
  openedAt: number;
  lastActivity: number;
  candidates: Candidate[];
  bestCandidateId: string | null;
  bestScore: number;
  /** Monotonic per-session counter. Incremented on every emission. */
  sequence: number;
  /** Active debounce timer for the current emit-then-refine window, if any. */
  debounceHandle: ReturnType<typeof setTimeout> | null;
};

/**
 * The arbiter's output — what the consumer protocol child issue will pick up
 * once the channel wire is retyped to carry it directly.
 *
 * Until that child issue lands, the arbiter still emits across the existing
 * `SwapEvent`-typed channel and the wrapping metadata stays local to the
 * `injected.content.ts` adapter. The shape is defined here so the consumer
 * can import it without churn.
 */
export type QuoteUpdate = {
  swap: SwapEvent;
  sessionKey: SessionKey;
  /** Monotonic per-session — consumers use it to discard out-of-order replacements. */
  sequence: number;
  /** Confidence in `[0, 1]`. See `CONFIDENCE` for the tier mapping. */
  confidence: number;
  candidateId: string;
};

/**
 * Confidence tiers the arbiter assigns when emitting.
 *
 * The first emission in a session uses the no-grounding tier matching the
 * candidate's provenance (`heuristic` 0.3, `template` 0.6). Once the DOM
 * grounding child issue lands and the grounding provider returns a non-zero
 * boost for the current best, the arbiter lifts the emission to the
 * `grounded` tier.
 */
export const CONFIDENCE = {
  heuristic: 0.3,
  template: 0.6,
  grounded: 0.9,
} as const;

/**
 * Callback the arbiter consults before each emission.
 *
 * Takes the candidates currently held for a session and returns a per-
 * candidate boost (keyed by `Candidate.id`). The arbiter adds the boost to
 * the scorer output and, if the best candidate's boost is non-zero, emits at
 * the `grounded` confidence tier.
 *
 * The default provider returns an empty `Map` (zero boost) until the DOM
 * grounding child issue replaces it via `arbiter.setGroundingProvider`.
 */
export type GroundingProvider = (candidates: Candidate[]) => Map<string, number>;
