import { formatUnits } from "viem";

/** Sensible default precision for amount display. MAR-33 owns the final spec. */
const DEFAULT_SIGNIFICANT_DIGITS = 4;

/** Fallback decimals when the token is unknown (`getTokenInfo` returned `null`). */
const FALLBACK_DECIMALS = 18;

/**
 * Render a raw uint256 amount as a short human-readable string.
 *
 * Uses `formatUnits` with the supplied `decimals`, then truncates the result
 * to ~{@link DEFAULT_SIGNIFICANT_DIGITS} significant digits with trailing
 * zeros stripped. When `decimals` is `undefined` (e.g. the token wasn't
 * found in the metadata cache), falls back to {@link FALLBACK_DECIMALS} —
 * 18 covers ETH and the vast majority of ERC-20s.
 *
 * @remarks
 * This is a best-effort display formatter for V1. Precise rules (locale
 * grouping, percent rounding, conservative rounding direction) live on
 * MAR-33. Returns the raw string unchanged on parse failure so the overlay
 * still renders *something*.
 */
export function formatDisplayAmount(
  raw: string,
  decimals: number | undefined,
): string {
  let value: bigint;
  try {
    value = BigInt(raw);
  } catch {
    return raw;
  }
  const dec = decimals ?? FALLBACK_DECIMALS;
  const formatted = formatUnits(value, dec);
  return trimToSignificantDigits(formatted, DEFAULT_SIGNIFICANT_DIGITS);
}

function trimToSignificantDigits(value: string, sigFigs: number): string {
  const [intPart, fracPart = ""] = value.split(".");
  // Integer part already meets/exceeds the precision budget — drop the fraction.
  if (intPart !== "0" && intPart !== "" && intPart !== "-0") {
    const intDigits = intPart.replace(/^-/, "").length;
    if (intDigits >= sigFigs) return intPart;
    const fracBudget = sigFigs - intDigits;
    const trimmed = fracPart.slice(0, fracBudget).replace(/0+$/, "");
    return trimmed.length > 0 ? `${intPart}.${trimmed}` : intPart;
  }
  if (fracPart === "") return intPart || "0";
  // Sub-1: count significant digits starting from the first non-zero.
  const leadingZeros = fracPart.match(/^0*/)?.[0].length ?? 0;
  const significant = fracPart
    .slice(leadingZeros, leadingZeros + sigFigs)
    .replace(/0+$/, "");
  if (significant.length === 0) return "0";
  const sign = intPart.startsWith("-") ? "-" : "";
  return `${sign}0.${"0".repeat(leadingZeros)}${significant}`;
}
