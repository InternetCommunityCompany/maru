import { describe, expect, it } from "vitest";
import { coerceChainId } from "./coerce-chain-id";

describe("coerceChainId", () => {
  describe("numeric inputs", () => {
    it("passes through plain positive numbers", () => {
      expect(coerceChainId(1)).toBe(1);
      expect(coerceChainId(137)).toBe(137);
      expect(coerceChainId(42161)).toBe(42161);
    });

    it("parses digit strings", () => {
      expect(coerceChainId("1")).toBe(1);
      expect(coerceChainId("137")).toBe(137);
    });

    it("narrows bigints to number", () => {
      expect(coerceChainId(1n)).toBe(1);
      expect(coerceChainId(42161n)).toBe(42161);
    });
  });

  describe("string aliases", () => {
    it("recognises canonical chain names", () => {
      expect(coerceChainId("ethereum")).toBe(1);
      expect(coerceChainId("polygon")).toBe(137);
      expect(coerceChainId("arbitrum")).toBe(42161);
      expect(coerceChainId("optimism")).toBe(10);
      expect(coerceChainId("base")).toBe(8453);
    });

    it("recognises common short aliases", () => {
      expect(coerceChainId("eth")).toBe(1);
      expect(coerceChainId("bnb")).toBe(56);
      expect(coerceChainId("arb")).toBe(42161);
      expect(coerceChainId("opt")).toBe(10);
      expect(coerceChainId("matic")).toBe(137);
      expect(coerceChainId("pol")).toBe(137);
    });

    it("is case-insensitive", () => {
      expect(coerceChainId("Ethereum")).toBe(1);
      expect(coerceChainId("ETH")).toBe(1);
      expect(coerceChainId("ArBiTrUm")).toBe(42161);
    });

    it("handles both `arbitrum-one` and `arbitrum_one`", () => {
      expect(coerceChainId("arbitrum-one")).toBe(42161);
      expect(coerceChainId("arbitrum_one")).toBe(42161);
    });
  });

  describe("rejected inputs", () => {
    it("returns null for null and undefined", () => {
      expect(coerceChainId(null)).toBeNull();
      expect(coerceChainId(undefined)).toBeNull();
    });

    it("returns null for unknown strings", () => {
      expect(coerceChainId("notachain")).toBeNull();
      expect(coerceChainId("")).toBeNull();
    });

    it("returns null for non-positive numbers", () => {
      expect(coerceChainId(0)).toBeNull();
      expect(coerceChainId(-1)).toBeNull();
    });

    it("returns null for non-finite numbers", () => {
      expect(coerceChainId(NaN)).toBeNull();
      expect(coerceChainId(Infinity)).toBeNull();
    });

    it("returns null for plain objects", () => {
      expect(coerceChainId({})).toBeNull();
      expect(coerceChainId({ chainId: 1 })).toBeNull();
    });
  });
});
