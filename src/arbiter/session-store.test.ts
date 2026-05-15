import { describe, expect, it } from "vitest";
import { SessionStore } from "./session-store";

describe("SessionStore.openOrGet", () => {
  it("opens a fresh session on first lookup", () => {
    const store = new SessionStore();
    const { session, opened } = store.openOrGet("k1", "p1");
    expect(opened).toBe(true);
    expect(session.key).toBe("k1");
    expect(session.partialKey).toBe("p1");
    expect(session.candidates).toEqual([]);
    expect(session.bestCandidateId).toBeNull();
    expect(session.sequence).toBe(0);
  });

  it("returns the same session on subsequent lookups for the same key", () => {
    const store = new SessionStore();
    const first = store.openOrGet("k1", "p1").session;
    const second = store.openOrGet("k1", "p1");
    expect(second.opened).toBe(false);
    expect(second.session).toBe(first);
  });

  it("evicts the prior session when a new full key shares a partial key", () => {
    // Simulates the user typing a new amount on the same trade pair.
    const store = new SessionStore();
    store.openOrGet("k-1000", "p-pair");
    expect(store.size).toBe(1);

    const { opened } = store.openOrGet("k-2000", "p-pair");
    expect(opened).toBe(true);
    expect(store.size).toBe(1);
    expect(store.get("k-1000")).toBeUndefined();
    expect(store.get("k-2000")).toBeDefined();
  });

  it("keeps sessions with different partial keys alongside each other", () => {
    const store = new SessionStore();
    store.openOrGet("k1", "pair-A");
    store.openOrGet("k2", "pair-B");
    expect(store.size).toBe(2);
  });

  it("updates lastActivity on re-open of an existing session", () => {
    let t = 1_000;
    const store = new SessionStore({ now: () => t });
    const { session } = store.openOrGet("k1", "p1");
    expect(session.lastActivity).toBe(1_000);
    t = 5_000;
    store.openOrGet("k1", "p1");
    expect(session.lastActivity).toBe(5_000);
  });
});

describe("SessionStore idle eviction", () => {
  it("sweeps sessions older than the idle TTL on the next access", () => {
    let t = 1_000;
    const store = new SessionStore({ idleTtlMs: 1_000, now: () => t });
    store.openOrGet("k1", "p1");
    expect(store.size).toBe(1);

    t = 5_000;
    // Touching the store via a different key triggers a sweep.
    store.openOrGet("k2", "p2");
    expect(store.get("k1")).toBeUndefined();
    expect(store.get("k2")).toBeDefined();
  });

  it("does not sweep sessions that are still fresh", () => {
    let t = 1_000;
    const store = new SessionStore({ idleTtlMs: 10_000, now: () => t });
    store.openOrGet("k1", "p1");
    t = 1_500;
    store.openOrGet("k2", "p2");
    expect(store.get("k1")).toBeDefined();
    expect(store.get("k2")).toBeDefined();
  });
});

describe("SessionStore.delete", () => {
  it("removes the session from the store", () => {
    const store = new SessionStore();
    store.openOrGet("k1", "p1");
    store.delete("k1");
    expect(store.get("k1")).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("is idempotent on a missing key", () => {
    const store = new SessionStore();
    expect(() => store.delete("does-not-exist")).not.toThrow();
  });

  it("clears a pending debounce timer so it cannot fire post-eviction", () => {
    const store = new SessionStore();
    const { session } = store.openOrGet("k1", "p1");
    let fired = false;
    session.debounceHandle = setTimeout(() => {
      fired = true;
    }, 0);
    store.delete("k1");
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(fired).toBe(false);
        resolve();
      }, 10);
    });
  });
});
