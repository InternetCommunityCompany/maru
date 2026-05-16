import { describe, expect, it } from "vitest";
import { isDebugEnvelope } from "./debug-channel";

describe("isDebugEnvelope", () => {
  it("accepts an object tagged with __maru === 'debug'", () => {
    const envelope = {
      __maru: "debug",
      event: {
        kind: "template_loaded",
        at: 0,
        templateId: "uniswap",
        version: "1",
        hostMatch: "app.uniswap.org",
      },
    };
    expect(isDebugEnvelope(envelope)).toBe(true);
  });

  it("rejects objects without the __maru tag", () => {
    expect(isDebugEnvelope({ event: {} })).toBe(false);
  });

  it("rejects objects with the wrong __maru tag (e.g. quote envelope)", () => {
    expect(isDebugEnvelope({ __maru: "quote", update: {} })).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isDebugEnvelope(null)).toBe(false);
    expect(isDebugEnvelope(undefined)).toBe(false);
  });

  it("rejects non-object primitives", () => {
    expect(isDebugEnvelope("debug")).toBe(false);
    expect(isDebugEnvelope(0)).toBe(false);
    expect(isDebugEnvelope(true)).toBe(false);
  });
});
