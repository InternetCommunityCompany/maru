import type { InterceptedEvent } from "@/interceptors/install-interceptors";
import type { SwapEvent } from "@/template-engine/build-swap-event";

export type CandidatePhase = InterceptedEvent["phase"];

/**
 * A `SwapEvent` wrapped with the ingest-site metadata the arbiter and scorer
 * need but which the engines deliberately don't carry. The wrap happens at
 * the arbiter ingest boundary so detection engines stay pure `SwapEvent`
 * producers.
 */
export type Candidate = {
  /**
   * Built from `(interceptedId, phase, templateId, amountOut)` so two phases
   * of the same call (or two engines extracting different amounts from one
   * call) don't collide.
   */
  id: string;
  swap: SwapEvent;
  /** Stable across request/response phases of the same intercepted call. */
  interceptedId: string;
  phase: CandidatePhase;
  source: InterceptedEvent["source"];
  /** Request URL for `fetch`/`xhr`; absent for `ethereum`. */
  url?: string;
  /** Wall-clock ms at arbiter ingest. */
  ingestedAt: number;
};

/**
 * Opaque string built from `(domain, chainIn, chainOut, tokenIn, tokenOut, amountIn)`
 * with addresses lower-cased and `amountIn` normalised through `BigInt`.
 * Produced and consumed only by `session-key.ts`.
 */
export type SessionKey = string;

/**
 * Same shape as `SessionKey` minus `amountIn`. `SessionStore` uses it to
 * evict any prior session for the same trade pair when the user types a new
 * amount — otherwise every keystroke would leave an abandoned session live.
 */
export type SessionPartialKey = string;

/** In-flight aggregation for a single quote attempt. */
export type QuoteSession = {
  key: SessionKey;
  partialKey: SessionPartialKey;
  openedAt: number;
  lastActivity: number;
  candidates: Candidate[];
  bestCandidateId: string | null;
  bestScore: number;
  /** Monotonic per-session — incremented on every emission. */
  sequence: number;
  debounceHandle: ReturnType<typeof setTimeout> | null;
};

/**
 * The arbiter's output — wire payload from the MAIN-world producer to the
 * background orchestrator. Within a session, `sequence` is monotonic;
 * consumers drop any arrival whose `sequence` isn't strictly greater than
 * the stored one.
 *
 * `confidence` is a continuous `[0, 1]` value. Consumers should compare with
 * ranges, not exact constants — the producer-side tier table (see
 * {@link CONFIDENCE}) may grow finer-grained.
 */
export type QuoteUpdate = {
  swap: SwapEvent;
  sessionKey: SessionKey;
  sequence: number;
  confidence: number;
  candidateId: string;
};

/**
 * Confidence tiers the arbiter assigns when emitting.
 *
 * - `heuristic` — heuristic match, no DOM grounding hit.
 * - `template`  — template match, no DOM grounding hit.
 * - `grounded`  — best candidate has a non-zero grounding boost (either tier).
 */
export const CONFIDENCE = {
  heuristic: 0.3,
  template: 0.6,
  grounded: 0.9,
} as const;

/**
 * Per-candidate boost (keyed by `Candidate.id`). The arbiter adds the boost
 * to the scorer output and lifts the emission to the `grounded` tier when
 * the best candidate's boost is non-zero. Default provider returns an empty
 * `Map` until DOM grounding is wired.
 */
export type GroundingProvider = (candidates: Candidate[]) => Map<string, number>;
