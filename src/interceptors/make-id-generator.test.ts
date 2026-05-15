import { describe, expect, it } from "vitest";
import { makeIdGenerator } from "./make-id-generator";

describe("makeIdGenerator", () => {
  describe("shape", () => {
    it("returns ids prefixed with the configured source name", () => {
      const next = makeIdGenerator("fetch");
      expect(next()).toMatch(/^fetch-/);
    });

    it("emits ids in the `prefix-session-counter` format", () => {
      const next = makeIdGenerator("xhr");
      // session is 6 base36 chars (slice(2, 8) of Math.random().toString(36)),
      // but values can be shorter when the random seed produces leading zeros
      // that toString(36) drops — accept up to 6 alphanumerics there.
      expect(next()).toMatch(/^xhr-[a-z0-9]{1,6}-[0-9a-z]+$/);
    });

    it("preserves the prefix verbatim, even when empty", () => {
      const next = makeIdGenerator("");
      expect(next().startsWith("-")).toBe(true);
    });
  });

  describe("counter", () => {
    it("starts at 1 (base36) on the first call", () => {
      const next = makeIdGenerator("eth");
      expect(next().endsWith("-1")).toBe(true);
    });

    it("increments monotonically across successive calls", () => {
      const next = makeIdGenerator("eth");
      const a = next();
      const b = next();
      const c = next();
      // Strip prefix+session, leaving just the counter component.
      const counter = (id: string) => id.split("-").pop()!;
      expect(counter(a)).toBe("1");
      expect(counter(b)).toBe("2");
      expect(counter(c)).toBe("3");
    });

    it("renders the counter in base36 once it crosses single digits", () => {
      const next = makeIdGenerator("p");
      for (let i = 1; i < 10; i++) next();
      // 10th call → "a" in base36
      expect(next().endsWith("-a")).toBe(true);
    });
  });

  describe("isolation between generators", () => {
    it("keeps counters independent across separate generators", () => {
      const a = makeIdGenerator("a");
      const b = makeIdGenerator("b");
      a();
      a();
      const fromB = b();
      expect(fromB.endsWith("-1")).toBe(true);
    });

    it("uses a fresh session salt per generator (almost always)", () => {
      // Random salts so this is probabilistic; collisions across 6 base36
      // chars are ~1 in 2 billion. Generate many to be safe.
      const sessions = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const id = makeIdGenerator("x")();
        sessions.add(id.split("-")[1]);
      }
      expect(sessions.size).toBeGreaterThan(1);
    });
  });
});
