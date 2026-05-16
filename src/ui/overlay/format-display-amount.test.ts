import { describe, expect, it } from "vitest";
import { formatDisplayAmount } from "./format-display-amount";

describe("formatDisplayAmount", () => {
  it("formats integer amounts at the supplied decimals", () => {
    expect(formatDisplayAmount("100000000", 6)).toBe("100");
    expect(formatDisplayAmount("1000000000000000000", 18)).toBe("1");
  });

  it("trims sub-1 fractional amounts to four significant digits", () => {
    // 0.031742893... WETH → 0.03174
    expect(formatDisplayAmount("31742893765432100", 18)).toBe("0.03174");
  });

  it("trims trailing zeros from formatted output", () => {
    // 100.5 should not render as 100.5000…
    expect(formatDisplayAmount("100500000", 6)).toBe("100.5");
  });

  it("falls back to 18 decimals when token decimals are unknown", () => {
    // 1 ether at 18 decimals
    expect(formatDisplayAmount("1000000000000000000", undefined)).toBe("1");
  });

  it("returns the raw string on parse failure", () => {
    expect(formatDisplayAmount("not-a-number", 18)).toBe("not-a-number");
  });

  it("renders zero without padding", () => {
    expect(formatDisplayAmount("0", 18)).toBe("0");
  });
});
