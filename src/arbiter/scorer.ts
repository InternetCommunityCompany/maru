import type { Candidate, QuoteSession } from "./types";

const PROVENANCE_TEMPLATE = 0.6;
const PROVENANCE_HEURISTIC = 0.3;
const RESPONSE_BONUS = 0.2;
// Per-bit weight on the amountOut bit-length. Keeps the rank component
// continuous and monotonic in amountOut (larger output → strictly larger
// rank) while keeping the contribution small enough that provenance and
// phase still dominate. A 256-bit max wei value lands at 0.256 — below
// provenance + phase, above the typical grounding boost.
const RANK_PER_BIT = 0.001;

const toBigInt = (v: string): bigint | null => {
  try {
    return BigInt(v.includes(".") ? v.slice(0, v.indexOf(".")) : v);
  } catch {
    return null;
  }
};

// Bit-length of a non-negative bigint. Used as a log-scale proxy for
// amountOut magnitude so the rank component stays bounded for wei-scale
// numbers that overflow Number.
const bitLength = (v: bigint): number => {
  if (v <= 0n) return 0;
  return v.toString(2).length;
};

const amountOutRank = (candidate: Candidate): number => {
  const mine = toBigInt(candidate.swap.amountOut);
  if (mine === null) return 0;
  return bitLength(mine) * RANK_PER_BIT;
};

/**
 * Pure scorer for an arbiter candidate. Higher is better.
 *
 * The score combines:
 * - **provenance**: template > heuristic. Templates are curated; heuristics
 *   are alias guesses.
 * - **phase**: response (completed) > request (pending).
 * - **amountOut rank**: a continuous bit-length component so candidates
 *   with a larger output score strictly higher (the UI typically displays
 *   the highest quote, so this is the candidate the user is most likely
 *   looking at). Bit-length is used as a log-scale proxy so wei-scale
 *   bigints don't blow up the score.
 * - **grounding boost**: passed through from the DOM grounding provider,
 *   typically in `[0, 1]`. Treated as a flat additive lift so a strong
 *   grounding hit can override provenance.
 *
 * Pure: `session` is currently unused (rank is per-candidate), but the
 * parameter is kept on the signature so a future refinement that needs
 * session-relative context can land without churning every call site.
 */
export function score(
  candidate: Candidate,
  _session: QuoteSession,
  groundingBoost: number = 0,
): number {
  const provenance =
    candidate.swap.templateId === "heuristic"
      ? PROVENANCE_HEURISTIC
      : PROVENANCE_TEMPLATE;
  const phase = candidate.phase === "response" ? RESPONSE_BONUS : 0;
  const rank = amountOutRank(candidate);
  return provenance + phase + rank + groundingBoost;
}
