import { describe, expect, it } from "vitest";
import { matchesDomain } from "./matches-domain";

describe("matchesDomain", () => {
  describe("no domain restriction", () => {
    it("returns the host when `domains` is undefined", () => {
      expect(matchesDomain("example.com", undefined)).toBe("example.com");
    });

    it("returns the host when `domains` is an empty array", () => {
      expect(matchesDomain("example.com", [])).toBe("example.com");
    });
  });

  describe("exact match", () => {
    it("matches when host equals an entry", () => {
      expect(matchesDomain("jumper.xyz", ["jumper.xyz"])).toBe("jumper.xyz");
    });

    it("returns the matched entry when multiple are listed", () => {
      expect(
        matchesDomain("jumper.exchange", ["jumper.xyz", "jumper.exchange"]),
      ).toBe("jumper.exchange");
    });
  });

  describe("subdomain match", () => {
    it("matches a one-level subdomain", () => {
      expect(matchesDomain("app.jumper.xyz", ["jumper.xyz"])).toBe(
        "jumper.xyz",
      );
    });

    it("matches a multi-level subdomain", () => {
      expect(
        matchesDomain("api.staging.jumper.xyz", ["jumper.xyz"]),
      ).toBe("jumper.xyz");
    });

    it("returns the parent entry, not the actual host", () => {
      // The matched entry is what's returned, so SwapEvent.domain stays
      // stable across subdomains.
      expect(matchesDomain("app.foo.example.com", ["example.com"])).toBe(
        "example.com",
      );
    });
  });

  describe("non-matches", () => {
    it("returns null when host is unrelated", () => {
      expect(matchesDomain("evil.com", ["jumper.xyz"])).toBeNull();
    });

    it("does not match a domain that only shares a suffix substring", () => {
      // `evil-jumper.xyz` ends with `jumper.xyz` but should NOT match — the
      // subdomain check requires a `.` boundary.
      expect(matchesDomain("evil-jumper.xyz", ["jumper.xyz"])).toBeNull();
    });

    it("does not match a parent of the restricted domain", () => {
      // `xyz` is the parent of `jumper.xyz`; it must not match.
      expect(matchesDomain("xyz", ["jumper.xyz"])).toBeNull();
    });

    it("is case-sensitive (callers must canonicalise hosts first)", () => {
      // Hosts coming out of `new URL(...).host` are already lowercase, so
      // mixed-case input represents a mistake on the caller's side; we
      // document it doesn't quietly match.
      expect(matchesDomain("Jumper.xyz", ["jumper.xyz"])).toBeNull();
    });
  });
});
