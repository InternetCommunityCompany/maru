import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import type { EvalContext } from "./build-eval-context";

const ctx = (overrides: Partial<EvalContext>): EvalContext =>
  overrides as EvalContext;

describe("evaluate — path grammar", () => {
  describe("source resolution", () => {
    it("returns the bound source for a bare `$source` expression", () => {
      expect(evaluate("$method", ctx({ method: "POST" }))).toBe("POST");
    });

    it("returns undefined for an unknown source key", () => {
      expect(evaluate("$missing", ctx({ method: "POST" }))).toBeUndefined();
    });

    it("returns undefined when the source itself is undefined", () => {
      expect(evaluate("$request", ctx({}))).toBeUndefined();
    });
  });

  describe("dot key access", () => {
    it("walks nested object keys", () => {
      const c = ctx({
        request: { fromToken: { address: "0xabc", chainId: 1 } },
      });
      expect(evaluate("$request.fromToken.address", c)).toBe("0xabc");
      expect(evaluate("$request.fromToken.chainId", c)).toBe(1);
    });

    it("returns undefined when an intermediate key is missing", () => {
      const c = ctx({ request: { fromToken: { address: "0xabc" } } });
      expect(evaluate("$request.fromToken.symbol", c)).toBeUndefined();
      expect(
        evaluate("$request.fromToken.symbol.length", c),
      ).toBeUndefined();
    });

    it("returns undefined when an intermediate value is null", () => {
      const c = ctx({ request: { fromToken: null } });
      expect(evaluate("$request.fromToken.address", c)).toBeUndefined();
    });

    it("treats `0` as a present value, not a missing intermediate", () => {
      const c = ctx({ request: { count: 0 } });
      expect(evaluate("$request.count", c)).toBe(0);
    });
  });

  describe("array index access", () => {
    it("resolves a positive index", () => {
      const c = ctx({ response: { routes: ["a", "b", "c"] } });
      expect(evaluate("$response.routes[0]", c)).toBe("a");
      expect(evaluate("$response.routes[2]", c)).toBe("c");
    });

    it("resolves a negative index from the end", () => {
      const c = ctx({ decoded: { path: ["0x1", "0x2", "0x3"] } });
      expect(evaluate("$decoded.path[-1]", c)).toBe("0x3");
      expect(evaluate("$decoded.path[-2]", c)).toBe("0x2");
    });

    it("returns undefined for an out-of-bounds positive index", () => {
      const c = ctx({ response: { routes: ["a"] } });
      expect(evaluate("$response.routes[5]", c)).toBeUndefined();
    });

    it("returns undefined for an out-of-bounds negative index", () => {
      const c = ctx({ response: { routes: ["a"] } });
      expect(evaluate("$response.routes[-5]", c)).toBeUndefined();
    });

    it("returns undefined when indexing a non-array", () => {
      const c = ctx({ response: { routes: { foo: "bar" } } });
      expect(evaluate("$response.routes[0]", c)).toBeUndefined();
    });

    it("chains keys after an index", () => {
      const c = ctx({
        response: {
          routes: [{ id: "r1" }, { id: "r2" }],
        },
      });
      expect(evaluate("$response.routes[1].id", c)).toBe("r2");
    });

    it("chains an index after another index", () => {
      const c = ctx({
        params: [[["inner"]]] as unknown as EvalContext["params"],
      });
      expect(evaluate("$params[0][0][0]", c)).toBe("inner");
    });
  });

  describe("malformed expressions", () => {
    it("returns undefined when the expression does not start with `$`", () => {
      expect(evaluate("request.foo", ctx({ request: { foo: 1 } }))).toBeUndefined();
      expect(evaluate("", ctx({}))).toBeUndefined();
    });

    it("returns undefined when the source identifier is malformed", () => {
      // `$.foo` — no identifier between `$` and `.`
      expect(evaluate("$.foo", ctx({}))).toBeUndefined();
      // `$1foo` — identifier must start with a letter or underscore
      expect(evaluate("$1foo", ctx({}))).toBeUndefined();
    });

    it("returns undefined for unrecognised tokens after the source", () => {
      const c = ctx({ request: { foo: 1 } });
      // double dot
      expect(evaluate("$request..foo", c)).toBeUndefined();
      // missing closing bracket
      expect(evaluate("$request[0", c)).toBeUndefined();
      // bracketed key (non-numeric)
      expect(evaluate("$request[foo]", c)).toBeUndefined();
      // wildcard not supported
      expect(evaluate("$request.*", c)).toBeUndefined();
    });
  });

  describe("realistic template-style paths", () => {
    it("resolves a typical iterated-item path", () => {
      const c = ctx({
        item: {
          steps: [{ toolDetails: { name: "Squid" } }],
        },
      });
      expect(evaluate("$item.steps[0].toolDetails.name", c)).toBe("Squid");
    });

    it("resolves a URL-segment style path", () => {
      const c = ctx({
        url: {
          host: "example.com",
          path: "/quote/v7/1",
          segments: ["quote", "v7", "1"],
          full: "https://example.com/quote/v7/1",
          search: { fromChain: "eth" },
        },
      });
      expect(evaluate("$url.segments[0]", c)).toBe("quote");
      expect(evaluate("$url.search.fromChain", c)).toBe("eth");
    });

    it("resolves a `$decoded.path[-1]` style ABI path", () => {
      const c = ctx({
        decoded: { path: ["0xa", "0xb", "0xc"] },
      });
      expect(evaluate("$decoded.path[-1]", c)).toBe("0xc");
    });
  });
});
