import { describe, expect, it } from "vitest";
import { formatAmount } from "./format-amount";

describe("formatAmount: basic precision fan", () => {
  it("emits 0..min(decimals,8) dp for an 18-decimal token", () => {
    const out = formatAmount("500000000000000000", 18);
    // 0.5 ETH — every precision collapses to the same value after trailing
    // zero strip, so we expect "0", "1" (round-half-up at 0dp), "0.5".
    expect(out).toContain("0.5");
    expect(out).toContain("0");
    expect(out).toContain("1");
  });

  it("includes both floor and round-half-up at the boundary", () => {
    const out = formatAmount("1500000000000000000", 18);
    // 1.5 — at 0dp: floor=1, halfUp=2. Both must appear.
    expect(out).toContain("1");
    expect(out).toContain("2");
    expect(out).toContain("1.5");
  });

  it("caps precision at 8 dp even when the token has 18", () => {
    const out = formatAmount("123456789012345678", 18);
    // We must not emit any 9-dp variant.
    for (const v of out) {
      const dot = v.indexOf(".");
      if (dot >= 0) {
        const fracLen = v.length - dot - 1;
        // After trailing-zero strip the fractional part is at most 8.
        expect(fracLen).toBeLessThanOrEqual(8);
      }
    }
  });

  it("strips trailing zeros after rounding", () => {
    const out = formatAmount("1000000000000000000", 18);
    // 1.0, 1.00, 1.000 all collapse to "1" after strip.
    expect(out).toContain("1");
    expect(out).not.toContain("1.0");
    expect(out).not.toContain("1.00");
  });
});

describe("formatAmount: grouping variants", () => {
  it("emits ungrouped + US + EU + space-grouped for whole-number values >999", () => {
    const out = formatAmount("1234000000", 6); // 1234 USDC
    expect(out).toContain("1234");
    expect(out).toContain("1,234");
    expect(out).toContain("1.234");
    expect(out).toContain("1 234");
  });

  it("emits all locales for fractional values >999", () => {
    // 1234.5 — 6-decimals: 1234500000
    const out = formatAmount("1234500000", 6);
    expect(out).toContain("1234.5");
    expect(out).toContain("1234,5");
    expect(out).toContain("1,234.5");
    expect(out).toContain("1.234,5");
    expect(out).toContain("1 234,5");
  });

  it("does not emit grouped variants when integer part is <=999", () => {
    const out = formatAmount("500000000000000000", 18); // 0.5
    expect(out).toContain("0.5");
    expect(out).toContain("0,5");
    // No grouping when integer part is just "0".
    expect(out.every((v) => !v.includes(" "))).toBe(true);
  });
});

describe("formatAmount: USDC-scale values", () => {
  it("emits both grouped and 2dp variants for 1000 USDC", () => {
    const out = formatAmount("1000000000", 6);
    expect(out).toContain("1000");
    expect(out).toContain("1,000");
    expect(out).toContain("1.000"); // EU grouping looks like a decimal
    expect(out).toContain("1 000");
  });

  it("includes rounded 2dp display for a noisy USDC amount", () => {
    const out = formatAmount("1234567890", 6); // 1234.567890
    // The 6-decimal-cut precise value.
    expect(out).toContain("1234.56789"); // trailing zero stripped
    // Common UI display: 2dp half-up.
    expect(out).toContain("1234.57");
  });
});

describe("formatAmount: edge cases", () => {
  it("returns [] for non-numeric input", () => {
    expect(formatAmount("not-a-number", 18)).toEqual([]);
  });

  it("returns [] for negative amounts", () => {
    expect(formatAmount("-1", 18)).toEqual([]);
  });

  it("handles 0 atomic gracefully", () => {
    const out = formatAmount("0", 18);
    expect(out).toContain("0");
  });

  it("handles 0-decimals tokens (no fractional fan)", () => {
    const out = formatAmount("1234", 0);
    expect(out).toContain("1234");
    expect(out).toContain("1,234");
  });
});
