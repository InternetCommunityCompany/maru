import { describe, expect, it } from "vitest";
import { parseUrlParams } from "./parse-url-params";

describe("parseUrlParams", () => {
  describe("no query string", () => {
    it("returns an empty object for an absolute URL with no query", () => {
      expect(parseUrlParams("https://api.example.com/quote")).toEqual({});
    });

    it("returns an empty object for a relative URL with no query", () => {
      expect(parseUrlParams("/api/quote")).toEqual({});
    });

    it("returns an empty object for a URL ending in a bare `?`", () => {
      expect(parseUrlParams("https://api.example.com/quote?")).toEqual({});
    });
  });

  describe("query parsing", () => {
    it("parses a single key/value pair", () => {
      expect(parseUrlParams("https://api.example.com/q?chainId=1")).toEqual({
        chainId: "1",
      });
    });

    it("parses multiple key/value pairs", () => {
      expect(
        parseUrlParams(
          "https://api.example.com/q?chainId=1&fromTokenAddress=0xabc&amount=1000",
        ),
      ).toEqual({
        chainId: "1",
        fromTokenAddress: "0xabc",
        amount: "1000",
      });
    });

    it("decodes percent-encoded values", () => {
      // `%2C` is a comma — common in DEX `tokens=A,B,C` style queries.
      expect(
        parseUrlParams("https://api.example.com/q?tokens=0xabc%2C0xdef"),
      ).toEqual({ tokens: "0xabc,0xdef" });
    });

    it("represents empty values as empty strings", () => {
      expect(parseUrlParams("https://api.example.com/q?chainId=")).toEqual({
        chainId: "",
      });
    });

    it("treats valueless keys as empty strings", () => {
      // `?foo` (no `=`) is valid per URLSearchParams and resolves to "".
      expect(parseUrlParams("https://api.example.com/q?foo")).toEqual({
        foo: "",
      });
    });
  });

  describe("repeated keys", () => {
    it("keeps the first occurrence and drops later ones", () => {
      // First-valid-value semantics match how heuristicMatch picks among
      // aliases — important so URL ordering doesn't surprise the matcher.
      expect(
        parseUrlParams("https://api.example.com/q?chainId=1&chainId=137"),
      ).toEqual({ chainId: "1" });
    });
  });

  describe("relative URLs", () => {
    it("parses query params from a relative URL when `window` is undefined", () => {
      // In the vitest node environment there is no `window`, so the function
      // falls back to its `http://localhost` base — relative URLs still parse.
      expect(parseUrlParams("/v5.0/1/quote?chainId=1&amount=5")).toEqual({
        chainId: "1",
        amount: "5",
      });
    });

    it("parses query-only fragments like `?chainId=1`", () => {
      expect(parseUrlParams("?chainId=1")).toEqual({ chainId: "1" });
    });
  });

  describe("unparseable URLs", () => {
    it("returns an empty object for a string the URL parser rejects", () => {
      // A bare `http://` with no host is rejected by `new URL`. The function
      // must swallow the throw and return {} rather than blowing up the
      // matcher.
      expect(parseUrlParams("http://")).toEqual({});
    });

    it("returns an empty object for the empty string", () => {
      // `new URL("", "http://localhost")` succeeds and yields no search,
      // so this verifies the empty-query path, not the catch path.
      expect(parseUrlParams("")).toEqual({});
    });
  });
});
