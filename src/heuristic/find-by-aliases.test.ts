import { describe, expect, it } from "vitest";
import { findByAliases } from "./find-by-aliases";

const identity = <T>(v: unknown): T | null => v as T;

describe("findByAliases", () => {
  describe("alias resolution order", () => {
    it("returns the first alias whose value passes the validator", () => {
      const source = { tokenIn: "primary", srcToken: "fallback" };
      expect(
        findByAliases(source, ["tokenIn", "srcToken"], identity<string>),
      ).toBe("primary");
    });

    it("falls through to later aliases when earlier ones are absent", () => {
      const source = { srcToken: "fallback" };
      expect(
        findByAliases(source, ["tokenIn", "srcToken"], identity<string>),
      ).toBe("fallback");
    });

    it("falls through when an earlier alias's value fails validation", () => {
      const source = { tokenIn: "bad", srcToken: "good" };
      const onlyGood = (v: unknown) => (v === "good" ? "good" : null);
      expect(findByAliases(source, ["tokenIn", "srcToken"], onlyGood)).toBe(
        "good",
      );
    });

    it("returns null when every alias fails to resolve", () => {
      const source = { unrelated: 1 };
      expect(
        findByAliases(source, ["tokenIn", "srcToken"], identity<string>),
      ).toBeNull();
    });

    it("returns null when no aliases are supplied", () => {
      expect(findByAliases({ tokenIn: "x" }, [], identity<string>)).toBeNull();
    });
  });

  describe("dot-path navigation", () => {
    it("walks nested object keys", () => {
      const source = { fromToken: { address: "0xabc" } };
      expect(
        findByAliases(source, ["fromToken.address"], identity<string>),
      ).toBe("0xabc");
    });

    it("returns null when an intermediate key is missing", () => {
      const source = { fromToken: {} };
      expect(
        findByAliases(source, ["fromToken.address"], identity<string>),
      ).toBeNull();
    });

    it("returns null when an intermediate value is null", () => {
      const source = { fromToken: null };
      expect(
        findByAliases(source, ["fromToken.address"], identity<string>),
      ).toBeNull();
    });

    it("returns null when an intermediate value is a primitive", () => {
      const source = { fromToken: "0xabc" };
      expect(
        findByAliases(source, ["fromToken.address"], identity<string>),
      ).toBeNull();
    });
  });

  describe("source shapes", () => {
    it("returns null when the source itself is undefined", () => {
      expect(
        findByAliases(undefined, ["tokenIn"], identity<string>),
      ).toBeNull();
    });

    it("returns null when the source is null", () => {
      expect(findByAliases(null, ["tokenIn"], identity<string>)).toBeNull();
    });

    it("returns null when the source is a primitive", () => {
      expect(findByAliases("0xabc", ["tokenIn"], identity<string>)).toBeNull();
    });
  });

  describe("validator semantics", () => {
    it("passes the raw value (not the path) to the validator", () => {
      const source = { amount: 42 };
      const received: unknown[] = [];
      const capture = (v: unknown) => {
        received.push(v);
        return v as number;
      };
      findByAliases(source, ["amount"], capture);
      expect(received).toEqual([42]);
    });

    it("treats validator's null as 'try next alias'", () => {
      const source = { a: 1, b: 2 };
      const calls: unknown[] = [];
      const onlyTwo = (v: unknown) => {
        calls.push(v);
        return v === 2 ? 2 : null;
      };
      expect(findByAliases(source, ["a", "b"], onlyTwo)).toBe(2);
      // Both aliases were attempted in order.
      expect(calls).toEqual([1, 2]);
    });

    it("does not invoke the validator for undefined alias values", () => {
      const source = { present: "x" };
      let calls = 0;
      const counting = (v: unknown) => {
        calls += 1;
        return v as string;
      };
      findByAliases(source, ["missing", "present"], counting);
      expect(calls).toBe(1);
    });

    it("invokes the validator on a leaf null (so the validator decides)", () => {
      // navigate returns null at the leaf — only `undefined` is treated as
      // "skip this alias", because callers may legitimately want to reject
      // null via the validator instead of silently falling through.
      const source = { amount: null };
      const received: unknown[] = [];
      const capture = (v: unknown) => {
        received.push(v);
        return null;
      };
      expect(findByAliases(source, ["amount"], capture)).toBeNull();
      expect(received).toEqual([null]);
    });

    it("invokes the validator on falsy-but-present values like 0 and ''", () => {
      const received: unknown[] = [];
      const capture = (v: unknown) => {
        received.push(v);
        return v as number | string;
      };
      findByAliases({ a: 0, b: "" }, ["a", "b"], capture);
      expect(received).toEqual([0]);
    });
  });
});
