import { encodeFunctionData, parseAbi } from "viem";
import { describe, expect, it } from "vitest";
import { decodeCalldata } from "./decode-calldata";

const UNISWAP_V2_SIGS = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
] as const;

const encode = (
  signatures: readonly string[],
  functionName: string,
  args: readonly unknown[],
): `0x${string}` => {
  const params = {
    abi: parseAbi(signatures as readonly [string, ...string[]]),
    functionName,
    args,
  };
  // viem's signature is overloaded against the ABI literal; cast at the
  // boundary so tests can pass plain string signatures.
  return (encodeFunctionData as (p: unknown) => `0x${string}`)(params);
};

describe("decodeCalldata", () => {
  describe("successful decode", () => {
    it("decodes a single-signature ABI and binds named args", () => {
      const args = [
        100_000_000n,
        99_000_000n,
        [
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        ],
        "0x0000000000000000000000000000000000001234",
        1_700_000_000n,
      ] as const;
      const data = encode(
        UNISWAP_V2_SIGS,
        "swapExactTokensForTokens",
        args,
      );

      const result = decodeCalldata(UNISWAP_V2_SIGS, data);

      expect(result).not.toBeNull();
      expect(result!.functionName).toBe("swapExactTokensForTokens");
      expect(result!.args).toEqual({
        amountIn: 100_000_000n,
        amountOutMin: 99_000_000n,
        path: [
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        ],
        to: "0x0000000000000000000000000000000000001234",
        deadline: 1_700_000_000n,
      });
    });

    it("picks the matching selector from a multi-signature ABI", () => {
      const sigs = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function transfer(address to, uint256 amount) returns (bool)",
      ] as const;
      const data = encode(sigs, "transfer", [
        "0x0000000000000000000000000000000000001234",
        500n,
      ]);

      const result = decodeCalldata(sigs, data);

      expect(result?.functionName).toBe("transfer");
      expect(result?.args).toEqual({
        to: "0x0000000000000000000000000000000000001234",
        amount: 500n,
      });
    });
  });

  describe("named vs unnamed parameters", () => {
    it("skips unnamed parameters in the returned args record", () => {
      const sigs = [
        "function mix(uint256 amount, address)",
      ] as const;
      const data = encode(sigs, "mix", [
        42n,
        "0x0000000000000000000000000000000000001234",
      ]);

      const result = decodeCalldata(sigs, data);

      expect(result?.args).toEqual({ amount: 42n });
    });
  });

  describe("failure cases", () => {
    it("returns null for empty data", () => {
      expect(decodeCalldata(UNISWAP_V2_SIGS, "")).toBeNull();
    });

    it("returns null for data without the `0x` prefix", () => {
      // Even if it decoded, the prefix gate rejects it.
      expect(
        decodeCalldata(UNISWAP_V2_SIGS, "abcdef"),
      ).toBeNull();
    });

    it("returns null when the selector does not match any signature", () => {
      // `transfer` selector against a Uniswap V2 ABI list — different function
      const otherSigs = [
        "function transfer(address to, uint256 amount) returns (bool)",
      ] as const;
      const wrongSelectorData = encode(otherSigs, "transfer", [
        "0x0000000000000000000000000000000000001234",
        1n,
      ]);

      expect(decodeCalldata(UNISWAP_V2_SIGS, wrongSelectorData)).toBeNull();
    });

    it("returns null for malformed (truncated) calldata", () => {
      // Selector only, no encoded args — viem throws while decoding.
      expect(decodeCalldata(UNISWAP_V2_SIGS, "0x38ed1739")).toBeNull();
    });

    it("returns null for an invalid ABI signature list", () => {
      expect(
        decodeCalldata(["not a real signature"], "0x38ed1739"),
      ).toBeNull();
    });
  });

  describe("ABI memoization", () => {
    it("decodes consistently across repeated calls with the same array reference", () => {
      const data = encode(UNISWAP_V2_SIGS, "swapExactTokensForTokens", [
        1n,
        1n,
        ["0x0000000000000000000000000000000000000001"],
        "0x0000000000000000000000000000000000000002",
        1n,
      ]);

      const first = decodeCalldata(UNISWAP_V2_SIGS, data);
      const second = decodeCalldata(UNISWAP_V2_SIGS, data);

      expect(first).toEqual(second);
      expect(first?.functionName).toBe("swapExactTokensForTokens");
    });
  });
});
