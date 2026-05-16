import { describe, expect, it } from "vitest";
import { isDebugPanelHandshake } from "./debug-panel-channel";

describe("isDebugPanelHandshake", () => {
  it("accepts an object with a numeric tabId", () => {
    expect(isDebugPanelHandshake({ tabId: 42 })).toBe(true);
    expect(isDebugPanelHandshake({ tabId: 0 })).toBe(true);
  });

  it("rejects objects missing tabId", () => {
    expect(isDebugPanelHandshake({})).toBe(false);
    expect(isDebugPanelHandshake({ other: 1 })).toBe(false);
  });

  it("rejects objects with non-numeric tabId", () => {
    expect(isDebugPanelHandshake({ tabId: "42" })).toBe(false);
    expect(isDebugPanelHandshake({ tabId: null })).toBe(false);
    expect(isDebugPanelHandshake({ tabId: undefined })).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isDebugPanelHandshake(null)).toBe(false);
    expect(isDebugPanelHandshake(undefined)).toBe(false);
  });

  it("rejects non-object primitives", () => {
    expect(isDebugPanelHandshake(42)).toBe(false);
    expect(isDebugPanelHandshake("tab")).toBe(false);
    expect(isDebugPanelHandshake(true)).toBe(false);
  });
});
