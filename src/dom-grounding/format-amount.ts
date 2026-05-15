const MAX_DP_CAP = 8;

type Rounded = {
  /** Integer (whole) part as a non-negative bigint. */
  whole: bigint;
  /** Fractional part as a decimal string, **already** trailing-zero stripped. May be empty. */
  frac: string;
};

const roundAtomic = (
  atomic: bigint,
  decimals: number,
  dp: number,
  mode: "floor" | "halfUp",
): Rounded => {
  // `shift` is how many digits we're rounding off the right edge of `atomic`
  // before splitting into whole/fractional parts at `dp`.
  const shift = decimals - dp;
  let int: bigint;
  if (shift <= 0) {
    // Caller asked for more precision than the token has — pad zeros on the
    // right. Floor and half-up are identical here (nothing to round).
    const factor = 10n ** BigInt(-shift);
    int = atomic * factor;
  } else {
    const factor = 10n ** BigInt(shift);
    int = atomic / factor;
    if (mode === "halfUp") {
      const remainder = atomic % factor;
      // half-up: tie (== half) rounds up. We use >= half to match the UI
      // convention that 0.5 → 1, 1.5 → 2, etc.
      const half = factor / 2n + (factor % 2n);
      if (remainder >= half) int += 1n;
    }
  }
  if (dp === 0) return { whole: int, frac: "" };
  const dpFactor = 10n ** BigInt(dp);
  const whole = int / dpFactor;
  const fracBi = int % dpFactor;
  const fracPadded = fracBi.toString().padStart(dp, "0");
  // Trailing zeros are stripped here so "1.500" collapses to "1.5" — UIs
  // never display the dead zeros and we don't want the matcher chasing them.
  const frac = fracPadded.replace(/0+$/, "");
  return { whole, frac };
};

const groupDigits = (digits: string, sep: string): string => {
  if (digits.length <= 3) return digits;
  const out: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    out.unshift(digits.slice(Math.max(0, i - 3), i));
  }
  return out.join(sep);
};

const emit = (out: Set<string>, r: Rounded): void => {
  const whole = r.whole.toString();
  const wholeUs = groupDigits(whole, ",");
  const wholeEu = groupDigits(whole, ".");
  const wholeSpace = groupDigits(whole, " ");
  if (r.frac === "") {
    out.add(whole);
    if (wholeUs !== whole) {
      out.add(wholeUs);
      out.add(wholeEu);
      out.add(wholeSpace);
    }
    return;
  }
  // US locale: `,` thousands sep, `.` decimal sep. `1,234.56`
  out.add(`${whole}.${r.frac}`);
  // EU locale: `.` thousands sep, `,` decimal sep. `1.234,56`
  out.add(`${whole},${r.frac}`);
  if (wholeUs !== whole) {
    out.add(`${wholeUs}.${r.frac}`);
    out.add(`${wholeEu},${r.frac}`);
    // Pancake-observed space-grouped EU-decimal: `1 234,56`
    out.add(`${wholeSpace},${r.frac}`);
  }
};

/**
 * Build the variant fan the matcher searches for in the DOM.
 *
 * Given a raw atomic amount (integer string in token base units) and the
 * token's `decimals`, returns every rendered string a UI plausibly emits for
 * that value: each precision from 0 to `min(decimals, 8)` dp, in both
 * floor and round-half-up modes, ungrouped, US-grouped (`1,234.56`), EU-
 * grouped (`1.234,56`), and space-grouped (`1 234,56`). Trailing zeros are
 * stripped after rounding so `1.500` collapses to `1.5`.
 *
 * @remarks
 * Both rounding modes are emitted because UIs vary; emitting both is cheap
 * (the set dedupes). The approximation prefix (`~`, `≈`) is **not** emitted
 * here — the matcher strips it from rendered text before compare. Returns an
 * empty array if `atomic` isn't a non-negative integer string.
 */
export function formatAmount(atomic: string, decimals: number): string[] {
  let bi: bigint;
  try {
    bi = BigInt(atomic);
  } catch {
    return [];
  }
  if (bi < 0n) return [];
  if (!Number.isFinite(decimals) || decimals < 0) return [];

  const out = new Set<string>();
  const maxDp = Math.min(Math.floor(decimals), MAX_DP_CAP);
  for (let dp = 0; dp <= maxDp; dp++) {
    emit(out, roundAtomic(bi, decimals, dp, "floor"));
    emit(out, roundAtomic(bi, decimals, dp, "halfUp"));
  }
  return [...out];
}
