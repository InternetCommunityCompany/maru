import type { Candidate } from "@/arbiter/types";

/**
 * Synchronous metadata lookup for a `(chainId, address)` pair.
 *
 * The DOM grounding hot path (the MutationObserver flush) can't `await` token
 * resolution. The arbiter pre-warms async resolution at session-open time
 * via {@link DecimalsPrewarm}; the grounding module reads from this
 * synchronous accessor on every match. Returning `null` is the explicit
 * "decimals unknown" signal — the matcher skips grounding for that
 * candidate, and the arbiter falls through to the no-grounding tier.
 *
 * Once the MAR-82 token-info module lands, this is wired to
 * `getTokenInfoCached(chainId, address)` — that's the entire integration.
 */
export type TokenMetaResolver = (
  chainId: number,
  address: string,
) => TokenMeta | null;

/**
 * Token metadata the grounding module consumes.
 *
 * Only `decimals` is load-bearing (drives the formatter). `symbol`, when
 * available, contributes to proximity scoring — a candidate's variant near
 * its token symbol earns a stronger boost than a bare hit.
 */
export type TokenMeta = {
  decimals: number;
  symbol?: string;
};

/**
 * Optional async pre-warm hook. Called by the wiring layer when a session
 * opens so the synchronous {@link TokenMetaResolver} can be populated before
 * the next observer flush. Failure is non-fatal — the matcher just falls
 * through to the no-grounding path for that candidate.
 */
export type DecimalsPrewarm = (
  chainId: number,
  address: string,
) => Promise<void>;

/**
 * One text node captured by the walker.
 *
 * Carries the raw text plus enough ancestor-derived context for the matcher
 * to classify hits into tiers (selected-row, labelled, proximity, bare)
 * without re-walking the DOM.
 */
export type TextNodeSnapshot = {
  /** Raw text of the node (whitespace not collapsed). */
  text: string;
  /**
   * Concatenated `textContent` of the closest sufficiently-large ancestor.
   *
   * Used to detect labels (`you receive`, `min received`, ...) and proximity
   * to other candidate-related strings (`amountIn` value, token symbol).
   * Depth-limited so a `<body>`-rooted hit doesn't pull the whole page in.
   */
  contextText: string;
  /** Any ancestor has `aria-selected="true"`. */
  ariaSelected: boolean;
  /** Any ancestor has `role="radio"` and `aria-checked="true"`. */
  ariaChecked: boolean;
};

/**
 * Tier the matcher assigned to a hit. Stronger tiers earn larger boosts.
 *
 * - `selected` — the rendered string sits inside a node the UI has flagged
 *   as selected (`aria-selected="true"`, `role="radio"` + `aria-checked`, or
 *   a sibling "Best Return"/"Selected" label).
 * - `labelled` — the hit shares a labelled container with phrases like
 *   "you receive", "min received", "you pay". Distinguishes `amountOut`,
 *   `amountOutMin`, and `amountIn` rather than relying on text proximity.
 * - `proximity` — the hit appears in a container that also contains the
 *   candidate's other amount or token symbol. Weaker than labelled.
 * - `bare` — the variant appears somewhere in the page with no supporting
 *   context. Useful for single-candidate sessions where there's nothing to
 *   disambiguate against.
 */
export type HitTier = "selected" | "labelled" | "proximity" | "bare";

/**
 * Which side of the candidate produced the matched variant.
 *
 * Grounding both `amountIn` and `amountOut` lets the matcher cover exactIn
 * and exactOut sessions without the arbiter needing to know which is which —
 * entropy and label routing pick the user-typed side from the derived side.
 */
export type AmountSide = "amountOut" | "amountOutMin" | "amountIn";

/**
 * Internal record of a single matcher hit, kept around for evidence.
 *
 * Exposed via {@link GroundingDebug} so a future overlay can show *why* a
 * candidate scored the way it did, and for the gross-vs-net case where two
 * variants from the same candidate hit under different labels — the matcher
 * must surface both rather than silently picking one.
 */
export type Evidence = {
  variant: string;
  side: AmountSide;
  tier: HitTier;
  /** Count of digits in the matched variant (excluding separators/decimal point). */
  significantDigits: number;
  /**
   * `true` if the matched variant captures the candidate's full available
   * precision (i.e. no rounding lost information). Breaks ties between
   * candidates whose rounded variants collide on the same rendered string.
   */
  exactPrecision: boolean;
  /** Label phrase that pulled the hit into the `labelled` tier, if any. */
  label?: string;
};

/**
 * Bundled debug info per grounded candidate. Returned alongside the boost
 * map by the matcher; the arbiter consumes only the boosts, but the
 * `evidence` field is what the UI / dev tooling will pick up later.
 */
export type GroundingDebug = {
  boost: number;
  evidence: Evidence[];
};

/**
 * Result type returned by {@link MatchFn} — a synchronous map keyed by
 * `Candidate.id` carrying the boost and the evidence behind it.
 *
 * The arbiter's `GroundingProvider` shape projects this down to just the
 * boost; the evidence is kept here so we don't lose it across the boundary.
 */
export type GroundingMap = Map<string, GroundingDebug>;

/**
 * Pure matcher signature — given candidates and a text snapshot, return the
 * boost (and evidence) per candidate. Pure so the matcher is easy to unit
 * test against synthetic snapshots without spinning up a DOM.
 */
export type MatchFn = (
  candidates: Candidate[],
  snapshot: TextNodeSnapshot[],
  resolveMeta: TokenMetaResolver,
) => GroundingMap;
