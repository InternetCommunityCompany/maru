import { describe, expect, it } from "vitest";
import { normalizeTokenAddress } from "./normalize-token-address";

const ZERO = "0x0000000000000000000000000000000000000000";

describe("normalizeTokenAddress", () => {
  describe("ERC-20 / contract addresses", () => {
    it("passes a lowercase address through unchanged", () => {
      const addr = "0xdac17f958d2ee523a2206206994597c13d831ec7";
      expect(normalizeTokenAddress(addr)).toBe(addr);
    });

    it("preserves checksum casing on mixed-case addresses", () => {
      const addr = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
      expect(normalizeTokenAddress(addr)).toBe(addr);
    });

    it("accepts fully uppercase hex addresses", () => {
      const addr = "0xDAC17F958D2EE523A2206206994597C13D831EC7";
      expect(normalizeTokenAddress(addr)).toBe(addr);
    });

    it("does not rewrite a real address that happens to start with 0xeeee...", () => {
      // Looks like the 1inch sentinel but is one nibble short of being it
      const notQuite = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0";
      expect(normalizeTokenAddress(notQuite)).toBe(notQuite);
    });
  });

  describe("native-asset sentinels", () => {
    it("rewrites the 1inch / OKX sentinel to the zero address", () => {
      expect(
        normalizeTokenAddress("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"),
      ).toBe(ZERO);
    });

    it("rewrites the 1inch sentinel case-insensitively", () => {
      expect(
        normalizeTokenAddress("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"),
      ).toBe(ZERO);
    });

    it("rewrites symbolic native markers to the zero address", () => {
      expect(normalizeTokenAddress("native")).toBe(ZERO);
      expect(normalizeTokenAddress("eth")).toBe(ZERO);
      expect(normalizeTokenAddress("bnb")).toBe(ZERO);
      expect(normalizeTokenAddress("matic")).toBe(ZERO);
      expect(normalizeTokenAddress("pol")).toBe(ZERO);
      expect(normalizeTokenAddress("avax")).toBe(ZERO);
      expect(normalizeTokenAddress("ftm")).toBe(ZERO);
      expect(normalizeTokenAddress("celo")).toBe(ZERO);
      expect(normalizeTokenAddress("xdai")).toBe(ZERO);
    });

    it("rewrites symbolic markers case-insensitively", () => {
      expect(normalizeTokenAddress("ETH")).toBe(ZERO);
      expect(normalizeTokenAddress("Native")).toBe(ZERO);
      expect(normalizeTokenAddress("Matic")).toBe(ZERO);
    });
  });

  describe("rejected inputs", () => {
    it("returns null for non-string inputs", () => {
      expect(normalizeTokenAddress(null)).toBeNull();
      expect(normalizeTokenAddress(undefined)).toBeNull();
      expect(normalizeTokenAddress(0)).toBeNull();
      expect(normalizeTokenAddress({})).toBeNull();
      expect(normalizeTokenAddress([])).toBeNull();
    });

    it("returns null for the empty string", () => {
      expect(normalizeTokenAddress("")).toBeNull();
    });

    it("returns null for strings that are not addresses or sentinels", () => {
      expect(normalizeTokenAddress("usdc")).toBeNull();
      expect(normalizeTokenAddress("hello world")).toBeNull();
    });

    it("returns null for malformed hex addresses", () => {
      // Missing 0x prefix
      expect(
        normalizeTokenAddress("dac17f958d2ee523a2206206994597c13d831ec7"),
      ).toBeNull();
      // Too short
      expect(normalizeTokenAddress("0xdeadbeef")).toBeNull();
      // Too long
      expect(
        normalizeTokenAddress("0xdac17f958d2ee523a2206206994597c13d831ec700"),
      ).toBeNull();
      // Non-hex characters
      expect(
        normalizeTokenAddress("0xZZc17f958d2ee523a2206206994597c13d831ec7"),
      ).toBeNull();
    });
  });
});
