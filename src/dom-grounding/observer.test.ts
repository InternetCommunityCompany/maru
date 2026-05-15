// @vitest-environment happy-dom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createDomObserver } from "./observer";

beforeEach(() => {
  document.body.innerHTML = `<div id="initial">0.5</div>`;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("createDomObserver: snapshot lifecycle", () => {
  it("takes an initial snapshot on construction", () => {
    const handle = createDomObserver({ debounceMs: 200 });
    expect(handle).not.toBeNull();
    const snap = handle!.snapshot();
    expect(snap.some((s) => s.text.trim() === "0.5")).toBe(true);
    handle!.detach();
  });

  it("refreshes the snapshot after a mutation, debounced", async () => {
    const handle = createDomObserver({ debounceMs: 200 })!;
    // Mutate the DOM.
    const span = document.createElement("span");
    span.textContent = "1.23";
    document.body.appendChild(span);
    // Synchronously the snapshot still reflects the old state.
    let snap = handle.snapshot();
    expect(snap.some((s) => s.text.trim() === "1.23")).toBe(false);
    // Advance past the debounce — MutationObserver flushes are microtask-
    // scheduled in happy-dom, so let those run first.
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    snap = handle.snapshot();
    expect(snap.some((s) => s.text.trim() === "1.23")).toBe(true);
    handle.detach();
  });

  it("refresh() forces an immediate re-walk", () => {
    const handle = createDomObserver({ debounceMs: 200 })!;
    const span = document.createElement("span");
    span.textContent = "9.99";
    document.body.appendChild(span);
    const snap = handle.refresh();
    expect(snap.some((s) => s.text.trim() === "9.99")).toBe(true);
    handle.detach();
  });
});

describe("createDomObserver: detach-on-lock", () => {
  it("stops refreshing after detach", async () => {
    const walks = vi.fn((root: Node) => {
      // Stand-in walker to count invocations.
      void root;
      return [];
    });
    const handle = createDomObserver({ walk: walks, debounceMs: 200 })!;
    handle.detach();
    // After detach, mutations and timer ticks must not trigger walks.
    document.body.appendChild(document.createElement("div"));
    await Promise.resolve();
    vi.advanceTimersByTime(500);
    // One walk at construction; nothing after detach.
    expect(walks).toHaveBeenCalledTimes(1);
  });

  it("detach is idempotent", () => {
    const handle = createDomObserver({ debounceMs: 200 })!;
    handle.detach();
    expect(() => handle.detach()).not.toThrow();
  });

  it("refresh() after detach returns the last snapshot without re-walking", () => {
    const walks = vi.fn((_root: Node) => [
      {
        text: "frozen",
        contextText: "",
        ariaSelected: false,
        ariaChecked: false,
      },
    ]);
    const handle = createDomObserver({ walk: walks, debounceMs: 200 })!;
    handle.detach();
    const after = handle.refresh();
    expect(after[0]!.text).toBe("frozen");
    // Should not have walked again after detach.
    expect(walks).toHaveBeenCalledTimes(1);
  });
});
