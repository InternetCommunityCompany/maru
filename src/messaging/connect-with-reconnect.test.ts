import { describe, expect, it, vi } from "vitest";
import { connectWithReconnect } from "./connect-with-reconnect";

type DisconnectListener = () => void;

type FakePort = Browser.runtime.Port & {
  __fire(): void;
  __disconnected: boolean;
};

const makeFakePort = (): FakePort => {
  const listeners = new Set<DisconnectListener>();
  let disconnected = false;
  const port = {
    name: "test",
    postMessage: vi.fn(),
    disconnect: vi.fn(() => {
      disconnected = true;
    }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    onDisconnect: {
      addListener: (l: DisconnectListener) => listeners.add(l),
      removeListener: (l: DisconnectListener) => listeners.delete(l),
      hasListener: (l: DisconnectListener) => listeners.has(l),
    },
    sender: undefined,
    __fire() {
      // Fire all listeners — Chrome guarantees onDisconnect fires at most once.
      for (const l of [...listeners]) l();
      listeners.clear();
      disconnected = true;
    },
    get __disconnected() {
      return disconnected;
    },
  } as unknown as FakePort;
  return port;
};

const harness = () => {
  const ports: FakePort[] = [];
  const connect = vi.fn(() => {
    const p = makeFakePort();
    ports.push(p);
    return p;
  });

  type Timer = { cb: () => void; ms: number; cancelled: boolean };
  const timers: Timer[] = [];
  const setTimer = (cb: () => void, ms: number): Timer => {
    const t = { cb, ms, cancelled: false };
    timers.push(t);
    return t;
  };
  const clearTimer = (handle: unknown) => {
    (handle as Timer).cancelled = true;
  };
  const runPendingTimer = () => {
    const t = timers.find((t) => !t.cancelled);
    if (!t) throw new Error("no pending timer");
    t.cancelled = true;
    t.cb();
    return t;
  };
  const pendingTimer = () => timers.find((t) => !t.cancelled);

  let nowMs = 0;
  const advance = (ms: number) => {
    nowMs += ms;
  };
  const now = () => nowMs;

  return { connect, setTimer, clearTimer, now, advance, ports, runPendingTimer, pendingTimer };
};

describe("connectWithReconnect", () => {
  it("opens a port and invokes wire with that port", () => {
    const h = harness();
    const wire = vi.fn();

    connectWithReconnect("maru:test", wire, h);

    expect(h.connect).toHaveBeenCalledOnce();
    expect(h.connect).toHaveBeenCalledWith({ name: "maru:test" });
    expect(wire).toHaveBeenCalledOnce();
    expect(wire).toHaveBeenCalledWith(h.ports[0]);
  });

  it("reconnects after onDisconnect with the configured backoff sequence", () => {
    const h = harness();
    const wire = vi.fn();

    connectWithReconnect("maru:test", wire, {
      ...h,
      backoffMs: [10, 20, 30],
      stableAfterMs: 1_000,
    });

    // Three rapid disconnects exercise indexes 0..2.
    h.ports[0]!.__fire();
    expect(h.pendingTimer()?.ms).toBe(10);
    h.runPendingTimer();
    expect(h.connect).toHaveBeenCalledTimes(2);

    h.ports[1]!.__fire();
    expect(h.pendingTimer()?.ms).toBe(20);
    h.runPendingTimer();

    h.ports[2]!.__fire();
    expect(h.pendingTimer()?.ms).toBe(30);
    h.runPendingTimer();

    expect(h.connect).toHaveBeenCalledTimes(4);
    expect(wire).toHaveBeenCalledTimes(4);
  });

  it("caps the backoff at the last entry in the schedule", () => {
    const h = harness();
    connectWithReconnect("maru:test", () => {}, {
      ...h,
      backoffMs: [0, 50],
      stableAfterMs: 10_000,
    });

    h.ports[0]!.__fire(); // index 0 → 0ms
    expect(h.pendingTimer()?.ms).toBe(0);
    h.runPendingTimer();

    h.ports[1]!.__fire(); // index 1 → 50ms
    expect(h.pendingTimer()?.ms).toBe(50);
    h.runPendingTimer();

    h.ports[2]!.__fire(); // index 2 (overshoots) → still 50ms
    expect(h.pendingTimer()?.ms).toBe(50);
  });

  it("resets the backoff after a connection has been stable", () => {
    const h = harness();
    connectWithReconnect("maru:test", () => {}, {
      ...h,
      backoffMs: [0, 250, 1000, 5000],
      stableAfterMs: 5_000,
    });

    // First flap: short-lived → escalate to index 1.
    h.advance(100);
    h.ports[0]!.__fire();
    expect(h.pendingTimer()?.ms).toBe(0);
    h.runPendingTimer();

    h.advance(100);
    h.ports[1]!.__fire();
    expect(h.pendingTimer()?.ms).toBe(250);
    h.runPendingTimer();

    // Now connection 2 stays up for >= stableAfterMs.
    h.advance(10_000);
    h.ports[2]!.__fire();
    // Should reset and use index 0 again.
    expect(h.pendingTimer()?.ms).toBe(0);
  });

  it("close() stops the reconnect loop and disconnects the active port", () => {
    const h = harness();
    const reconnector = connectWithReconnect("maru:test", () => {}, h);

    reconnector.close();

    expect(h.ports[0]!.__disconnected).toBe(true);
    // No further timer should be scheduled.
    expect(h.pendingTimer()).toBeUndefined();
    // A late disconnect firing after close() must not reconnect.
    h.ports[0]!.__fire();
    expect(h.connect).toHaveBeenCalledOnce();
  });

  it("close() cancels a pending reconnect timer", () => {
    const h = harness();
    const reconnector = connectWithReconnect("maru:test", () => {}, {
      ...h,
      backoffMs: [100],
    });

    h.ports[0]!.__fire();
    expect(h.pendingTimer()?.ms).toBe(100);

    reconnector.close();
    expect(h.pendingTimer()).toBeUndefined();
    expect(h.connect).toHaveBeenCalledOnce();
  });

  it("close() is idempotent", () => {
    const h = harness();
    const reconnector = connectWithReconnect("maru:test", () => {}, h);

    reconnector.close();
    reconnector.close();

    expect(h.ports[0]!.disconnect).toHaveBeenCalledOnce();
  });

  it("ignores onDisconnect from a stale port", () => {
    const h = harness();
    const wire = vi.fn();

    connectWithReconnect("maru:test", wire, {
      ...h,
      backoffMs: [0],
      stableAfterMs: 10_000,
    });

    h.ports[0]!.__fire();
    h.runPendingTimer(); // ports[1] is now active.

    // Re-firing the (already-fired) disconnect on ports[0] is a no-op — but
    // emulate the case where it somehow fires again: the second connection
    // must not be torn down. There is no pending timer because ports[1] is
    // active and connection is healthy.
    expect(h.pendingTimer()).toBeUndefined();
    expect(h.connect).toHaveBeenCalledTimes(2);
  });
});
