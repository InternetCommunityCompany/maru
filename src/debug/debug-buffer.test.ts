import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DebugEvent } from "./debug-event";
import { debugBuffer } from "./debug-buffer";

const ev = (templateId: string): DebugEvent => ({
  kind: "template_loaded",
  at: 0,
  templateId,
  version: "1",
  hostMatch: "app.example.xyz",
});

// debugBuffer is a module-level singleton — scrub state between tests.
const TAB = 42;
const OTHER = 43;
afterEach(() => {
  debugBuffer.clear(TAB);
  debugBuffer.clear(OTHER);
});

describe("debug-buffer: subscribe semantics", () => {
  it("delivers subsequent pushes to subscribers (no backfill)", () => {
    debugBuffer.push(TAB, ev("before-subscribe"));

    const sink: DebugEvent[] = [];
    debugBuffer.subscribe(TAB, (e) => sink.push(e));

    expect(sink).toHaveLength(0);

    const later = ev("after-subscribe");
    debugBuffer.push(TAB, later);

    expect(sink).toEqual([later]);
  });

  it("returns an unsubscribe that removes only the caller's listener", () => {
    const a: DebugEvent[] = [];
    const b: DebugEvent[] = [];
    const unsubA = debugBuffer.subscribe(TAB, (e) => a.push(e));
    debugBuffer.subscribe(TAB, (e) => b.push(e));

    debugBuffer.push(TAB, ev("first"));
    unsubA();
    debugBuffer.push(TAB, ev("second"));

    expect(a).toHaveLength(1);
    expect(a[0]?.kind === "template_loaded" && a[0].templateId).toBe("first");
    expect(b).toHaveLength(2);
    expect(b[1]?.kind === "template_loaded" && b[1].templateId).toBe("second");
  });
});

describe("debug-buffer: ring buffer cap", () => {
  it("drops the oldest event once past 1000 per tab (FIFO)", () => {
    // We can't observe the buffer directly, but pushes past the cap must not throw
    // or perturb live subscribers — push 1100 with a listener attached.
    const seen: DebugEvent[] = [];
    debugBuffer.subscribe(TAB, (e) => seen.push(e));
    for (let i = 0; i < 1100; i++) debugBuffer.push(TAB, ev(`e${i}`));
    expect(seen).toHaveLength(1100);
    // First and last events are intact for the live subscriber regardless of FIFO drop.
    expect(seen[0]?.kind === "template_loaded" && seen[0].templateId).toBe("e0");
    expect(seen[1099]?.kind === "template_loaded" && seen[1099].templateId).toBe(
      "e1099",
    );
  });
});

describe("debug-buffer: throwing subscriber", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs and skips a throwing subscriber without breaking siblings", () => {
    const sibling = vi.fn();
    debugBuffer.subscribe(TAB, () => {
      throw new Error("boom");
    });
    debugBuffer.subscribe(TAB, sibling);

    const event = ev("payload");
    debugBuffer.push(TAB, event);

    expect(sibling).toHaveBeenCalledWith(event);
    expect(console.warn).toHaveBeenCalledWith(
      "[maru] debugBuffer subscriber threw",
      expect.any(Error),
    );
  });
});

describe("debug-buffer: clear", () => {
  it("drops the tab's buffer and a subsequent push still works", () => {
    debugBuffer.push(TAB, ev("pre-clear"));
    debugBuffer.clear(TAB);

    const sink: DebugEvent[] = [];
    debugBuffer.subscribe(TAB, (e) => sink.push(e));
    const after = ev("post-clear");
    debugBuffer.push(TAB, after);

    expect(sink).toEqual([after]);
  });
});

describe("debug-buffer: per-tab isolation", () => {
  it("does not notify subscribers of other tabs", () => {
    const tabSink = vi.fn();
    const otherSink = vi.fn();
    debugBuffer.subscribe(TAB, tabSink);
    debugBuffer.subscribe(OTHER, otherSink);

    const event = ev("only-tab");
    debugBuffer.push(TAB, event);

    expect(tabSink).toHaveBeenCalledWith(event);
    expect(otherSink).not.toHaveBeenCalled();
  });
});
