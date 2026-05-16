import { describe, expect, it, vi } from "vitest";
import type { DebugEvent } from "./debug-event";
import { onTrace, recordTrace } from "./debug-bus";

const templateLoaded = (templateId = "uniswap"): DebugEvent => ({
  kind: "template_loaded",
  at: 1_700_000_000_000,
  templateId,
  version: "1",
  hostMatch: "app.uniswap.org",
});

describe("debug-bus", () => {
  it("delivers recordTrace events to onTrace listeners in dev", () => {
    const listener = vi.fn();
    onTrace(listener);

    const event = templateLoaded();
    recordTrace(event);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(event);
  });

  it("fans out a single recordTrace to every registered listener", () => {
    const a = vi.fn();
    const b = vi.fn();
    onTrace(a);
    onTrace(b);

    const event = templateLoaded("1inch");
    recordTrace(event);

    expect(a).toHaveBeenCalledWith(event);
    expect(b).toHaveBeenCalledWith(event);
  });
});
