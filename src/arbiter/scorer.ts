import type { Candidate } from "./types";

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
 * Score = provenance (template 0.6, heuristic 0.3) + response-phase bonus (0.2)
 * + log-scale amountOut rank (≤ 0.256 for a 256-bit value) + grounding boost
 * (≥ 0). The amountOut rank uses bit-length so wei-scale `bigint`s don't blow
 * up the score; provenance + phase dominate it for normal inputs, but a
 * strong grounding boost can override provenance.
 */
export function score(
  candidate: Candidate,
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
