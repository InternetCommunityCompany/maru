import type { Candidate } from "@/arbiter/types";
import { formatAmount } from "./format-amount";
import type {
  AmountSide,
  Evidence,
  GroundingDebug,
  GroundingMap,
  HitTier,
  TextNodeSnapshot,
  TokenMeta,
  TokenMetaResolver,
} from "./types";

// Label phrases that pull a hit into the `labelled` tier. Lower-cased; we
// compare against a lower-cased context. `amountOutMin` labels are
// distinguished from `amountOut` ones so the matcher can route variants
// correctly without silently picking gross vs net.
const LABELS: Record<"out" | "outMin" | "in", readonly string[]> = {
  out: [
    "you receive",
    "you'll receive",
    "you will receive",
    "to receive",
    "receive (incl. fees)",
    "receive incl. fees",
    "receive (gross)",
    "expected output",
    "estimated output",
    "you get",
    "receive ",
    "receiving",
  ],
  outMin: [
    "min received",
    "minimum received",
    "min. received",
    "min receive",
    "minimum receive",
    "worst-case received",
    "at least",
    "receive at least",
  ],
  in: [
    "you pay",
    "you'll pay",
    "you will pay",
    "you send",
    "from amount",
    "pay ",
    "paying",
    "sell amount",
    "selling",
  ],
};

// Sibling labels that signal a route is the selected/best one even without
// `aria-selected`. Jumper-style multi-route UIs use these. Compared against
// lower-cased context text.
const SELECTED_PHRASES: readonly string[] = [
  "best return",
  "best price",
  "best route",
  "recommended",
  "selected",
  "preferred",
];

// Tier weights — base contribution before significant-digit scaling. The
// final boost is `weight * min(sigDigits, SIG_DIGIT_CAP) / SIG_DIGIT_CAP`,
// so each tier tops out at its weight when the matched variant has 8+
// significant digits.
const TIER_WEIGHT: Record<HitTier, number> = {
  selected: 1.0,
  labelled: 0.6,
  proximity: 0.3,
  bare: 0.1,
};

// Caps significant-digit scaling so a 12-digit hit isn't 50% bigger than an
// 8-digit one. Six-digit hits are already collision-proof against unrelated
// page text per the MAR-80 findings.
const SIG_DIGIT_CAP = 8;
// Below this many digits a hit is too prone to colliding with timestamps,
// route counts, percentage labels. We still emit at the bare tier but
// down-weight aggressively.
const MIN_USEFUL_DIGITS = 2;
// Tiebreaker boost when the matched variant captures the candidate's full
// available precision. Breaks ties between candidates whose rounded variants
// collide on the same node (e.g. 0.49 → "0.5" rounded vs 0.5 exact → "0.5")
// in favour of the one whose exact representation hit.
const EXACT_PRECISION_BONUS = 0.02;

const approxPrefix = /[~≈]/g;
const nbsp = / /g;

const normalizeForMatch = (s: string): string =>
  s.replace(approxPrefix, "").replace(nbsp, " ");

const countSignificantDigits = (variant: string): number => {
  let count = 0;
  for (const ch of variant) if (ch >= "0" && ch <= "9") count += 1;
  return count;
};

const LABEL_ROUTE: Array<{ side: AmountSide; phrases: readonly string[] }> = [
  // Order matters: check `outMin` before `out` so "min received" doesn't
  // also match the broader "receive" phrase.
  { side: "amountOutMin", phrases: LABELS.outMin },
  { side: "amountOut", phrases: LABELS.out },
  { side: "amountIn", phrases: LABELS.in },
];

const labelFor = (
  contextLower: string,
  side: AmountSide,
): string | null => {
  for (const { side: rs, phrases } of LABEL_ROUTE) {
    if (rs !== side) continue;
    for (const p of phrases) if (contextLower.includes(p)) return p;
  }
  return null;
};

const containsAnotherSideHint = (
  contextLower: string,
  side: AmountSide,
  candidate: Candidate,
  resolveMeta: TokenMetaResolver,
): boolean => {
  // Proximity check: does the context also carry the candidate's *other*
  // amount or token symbol? Reading the formatter-generated variants for
  // the other side would be exhaustive but expensive; we only need a coarse
  // signal here, so we lookup the other side's symbol and presence of any
  // digit run from it.
  const other =
    side === "amountIn"
      ? { addr: candidate.swap.tokenOut, chain: candidate.swap.chainOut }
      : { addr: candidate.swap.tokenIn, chain: candidate.swap.chainIn };
  const meta = resolveMeta(other.chain, other.addr);
  if (meta?.symbol && contextLower.includes(meta.symbol.toLowerCase())) {
    return true;
  }
  // Address tail (last 4 hex chars) is a defensive proximity signal when
  // the page shows truncated addresses instead of symbols. Cheap to check.
  const tail = other.addr.toLowerCase().slice(-4);
  if (tail.length === 4 && contextLower.includes(tail)) return true;
  return false;
};

const sourceAtomic = (
  candidate: Candidate,
  side: AmountSide,
): string | undefined => {
  if (side === "amountOut") return candidate.swap.amountOut;
  if (side === "amountOutMin") return candidate.swap.amountOutMin;
  return candidate.swap.amountIn;
};

const sideMeta = (
  candidate: Candidate,
  side: AmountSide,
  resolveMeta: TokenMetaResolver,
): TokenMeta | null => {
  if (side === "amountIn") {
    return resolveMeta(candidate.swap.chainIn, candidate.swap.tokenIn);
  }
  return resolveMeta(candidate.swap.chainOut, candidate.swap.tokenOut);
};

const computeBoost = (
  tier: HitTier,
  sigDigits: number,
  exactPrecision: boolean = false,
): number => {
  if (sigDigits < MIN_USEFUL_DIGITS) return 0;
  const capped = Math.min(sigDigits, SIG_DIGIT_CAP);
  const base = TIER_WEIGHT[tier] * (capped / SIG_DIGIT_CAP);
  return exactPrecision ? base + EXACT_PRECISION_BONUS : base;
};

const isContextSelected = (contextLower: string): boolean => {
  for (const p of SELECTED_PHRASES) if (contextLower.includes(p)) return true;
  return false;
};

const classifyTier = (
  node: TextNodeSnapshot,
  side: AmountSide,
  candidate: Candidate,
  resolveMeta: TokenMetaResolver,
): { tier: HitTier; label?: string } => {
  const contextLower = normalizeForMatch(node.contextText).toLowerCase();
  if (node.ariaSelected || node.ariaChecked || isContextSelected(contextLower)) {
    const label = labelFor(contextLower, side);
    return label ? { tier: "selected", label } : { tier: "selected" };
  }
  const label = labelFor(contextLower, side);
  if (label) return { tier: "labelled", label };
  if (containsAnotherSideHint(contextLower, side, candidate, resolveMeta)) {
    return { tier: "proximity" };
  }
  return { tier: "bare" };
};

const scanForVariants = (
  variants: readonly string[],
  snapshot: TextNodeSnapshot[],
  side: AmountSide,
  candidate: Candidate,
  resolveMeta: TokenMetaResolver,
): Evidence[] => {
  // Pre-sort variants by length DESC so a node hit on a longer variant
  // (more significant digits) shadows the shorter prefix on the same node.
  // Without this, "1234.567" and "1234" would both fire on a node showing
  // the longer string and the matcher would double-count.
  const sorted = [...variants].sort((a, b) => b.length - a.length);
  // Max sig digits across the fan tells us when a hit captures the
  // candidate's full available precision (no rounding lost information).
  const maxSig = sorted.reduce(
    (max, v) => Math.max(max, countSignificantDigits(v)),
    0,
  );
  const out: Evidence[] = [];
  for (const node of snapshot) {
    const haystack = normalizeForMatch(node.text);
    let matched: { variant: string; sig: number } | null = null;
    for (const v of sorted) {
      // Numeric variants can substring-match unrelated text ("0.5" inside
      // "10.5"); require the variant's neighbours to be non-digit. This is
      // cheap and avoids almost every collision we observed in MAR-80.
      const idx = haystack.indexOf(v);
      if (idx < 0) continue;
      const before = idx === 0 ? "" : haystack[idx - 1]!;
      const after =
        idx + v.length >= haystack.length ? "" : haystack[idx + v.length]!;
      if ((before >= "0" && before <= "9") || (after >= "0" && after <= "9")) {
        continue;
      }
      // Also reject if the surrounding chars are unrelated decimal/group
      // separators that would make the rendered value longer than the
      // variant (e.g. variant "12.34" hitting on "12.345").
      const isSep = (c: string): boolean => c === "." || c === "," || c === " ";
      if (
        (isSep(before) && before !== "" && haystack[idx - 2] !== undefined &&
          /[0-9]/.test(haystack[idx - 2]!)) ||
        (isSep(after) && haystack[idx + v.length + 1] !== undefined &&
          /[0-9]/.test(haystack[idx + v.length + 1]!))
      ) {
        // The variant landed mid-number — not a real hit.
        // But only reject if the separator is followed/preceded by digits.
        continue;
      }
      matched = { variant: v, sig: countSignificantDigits(v) };
      break;
    }
    if (!matched) continue;
    const { tier, label } = classifyTier(node, side, candidate, resolveMeta);
    out.push({
      variant: matched.variant,
      side,
      tier,
      significantDigits: matched.sig,
      exactPrecision: matched.sig >= maxSig,
      ...(label ? { label } : {}),
    });
  }
  return out;
};

const dedupeEvidence = (evidence: Evidence[]): Evidence[] => {
  // "Duplicate-node dedupe" (Matcha): same variant in multiple nodes —
  // prefer the most-labelled instance. We key by (side, variant, label) so
  // gross-vs-net hits (different labels on the same variant) survive into
  // the final-evidence step where they're surfaced.
  const TIER_ORDER: HitTier[] = ["selected", "labelled", "proximity", "bare"];
  const tierRank = (t: HitTier): number => TIER_ORDER.indexOf(t);
  const best = new Map<string, Evidence>();
  for (const e of evidence) {
    const key = `${e.side}|${e.variant}|${e.label ?? ""}`;
    const cur = best.get(key);
    if (!cur || tierRank(e.tier) < tierRank(cur.tier)) best.set(key, e);
  }
  return [...best.values()];
};

const boostOf = (e: Evidence): number =>
  computeBoost(e.tier, e.significantDigits, e.exactPrecision);

const selectFinalEvidence = (evidence: Evidence[]): Evidence[] => {
  // Gross-vs-net surfacing: when two `amountOut`-side hits have
  // **comparable** scores under **different** labels (one gross, one net),
  // surface both. We define "comparable" as within 0.15 boost and on
  // different labels.
  if (evidence.length === 0) return [];
  const sorted = [...evidence].sort((a, b) => boostOf(b) - boostOf(a));
  const top = sorted[0]!;
  const topBoost = boostOf(top);
  const kept: Evidence[] = [top];
  for (const e of sorted.slice(1)) {
    if (e.side !== top.side) continue;
    if (e.label && top.label && e.label !== top.label) {
      const boost = boostOf(e);
      if (topBoost - boost <= 0.15) kept.push(e);
    }
  }
  return kept;
};

/**
 * Match a set of arbiter candidates against a captured DOM snapshot and
 * return per-candidate boost + evidence.
 *
 * Pure: takes a snapshot rather than reading the DOM directly so the entire
 * scoring path is unit-testable without happy-dom.
 *
 * @remarks
 * Scoring layers, strongest to weakest:
 *
 * 1. **selected-row** — variant inside an `aria-selected`, `role=radio` +
 *    `aria-checked`, or sibling "Best Return"/"Selected"-labelled node.
 * 2. **labelled** — variant inside a container whose text carries one of the
 *    side-routing label phrases. Routes `amountOut`/`amountOutMin`/`amountIn`.
 * 3. **proximity** — variant inside a container that also carries the
 *    candidate's other-side token symbol or address tail.
 * 4. **bare** — variant appears anywhere; weakest, mostly useful for single-
 *    candidate sessions.
 *
 * The final boost per candidate is the best tier × significant-digits hit
 * across all sides, so a 6dp hit on `amountOut` dominates a 2dp hit on
 * `amountIn`.
 */
export function matchAmounts(
  candidates: Candidate[],
  snapshot: TextNodeSnapshot[],
  resolveMeta: TokenMetaResolver,
): GroundingMap {
  const result: GroundingMap = new Map();
  if (snapshot.length === 0) return result;

  for (const candidate of candidates) {
    const allEvidence: Evidence[] = [];
    for (const side of ["amountOut", "amountOutMin", "amountIn"] as const) {
      const atomic = sourceAtomic(candidate, side);
      if (!atomic) continue;
      const meta = sideMeta(candidate, side, resolveMeta);
      if (!meta) continue;
      const variants = formatAmount(atomic, meta.decimals);
      if (variants.length === 0) continue;
      allEvidence.push(
        ...scanForVariants(variants, snapshot, side, candidate, resolveMeta),
      );
    }
    if (allEvidence.length === 0) continue;
    const deduped = dedupeEvidence(allEvidence);
    const finalEvidence = selectFinalEvidence(deduped);
    const boost = Math.max(...finalEvidence.map(boostOf));
    if (boost <= 0) continue;
    const debug: GroundingDebug = { boost, evidence: finalEvidence };
    result.set(candidate.id, debug);
  }
  return result;
}
