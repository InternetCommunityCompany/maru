import { describe, expect, it } from "vitest";
import { safeText } from "./safe-text";

describe("safeText", () => {
  describe("happy paths", () => {
    it("returns a synchronous string verbatim", async () => {
      expect(await safeText(() => "hello")).toBe("hello");
    });

    it("awaits and returns an async string", async () => {
      expect(await safeText(async () => "hello")).toBe("hello");
    });

    it("returns the empty string when the reader yields it", async () => {
      // An empty body is still a valid readable body — distinct from `null`.
      expect(await safeText(() => "")).toBe("");
    });
  });

  describe("missing values", () => {
    it("returns null when the reader returns null", async () => {
      expect(await safeText(() => null)).toBeNull();
    });

    it("returns null when the reader returns undefined", async () => {
      expect(await safeText(() => undefined)).toBeNull();
    });

    it("returns null when an async reader resolves to null", async () => {
      expect(await safeText(async () => null)).toBeNull();
    });
  });

  describe("failure modes", () => {
    it("returns null when the reader throws synchronously", async () => {
      // Common in `Request.text()` on already-consumed bodies.
      expect(
        await safeText(() => {
          throw new Error("consumed");
        }),
      ).toBeNull();
    });

    it("returns null when an async reader rejects", async () => {
      expect(
        await safeText(async () => {
          throw new Error("stream lock");
        }),
      ).toBeNull();
    });
  });

  describe("non-string values", () => {
    it("returns null for a non-string sync return (defensive)", async () => {
      // The reader's typing forbids this, but the runtime check exists so
      // unexpected shapes don't propagate as objects masquerading as bodies.
      expect(await safeText((() => 42) as never)).toBeNull();
    });
  });
});
