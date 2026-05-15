/**
 * Callback invoked every time a fresh `runtime.Port` is established, including
 * after a reconnect. Receives the raw port so the caller can attach
 * `onMessage` / `onDisconnect` listeners or forward traffic through it.
 */
export type WireFn = (port: Browser.runtime.Port) => void;

/** Handle returned by {@link connectWithReconnect}. */
export type Reconnector = {
  /**
   * Stop the reconnect loop and disconnect the current port (if any). After
   * `close()`, no further reconnect attempts run. Idempotent.
   */
  close(): void;
};

/** Optional knobs for {@link connectWithReconnect}. */
export type ConnectOptions = {
  /**
   * Port factory. Defaults to `browser.runtime.connect`. Tests inject a stub
   * that returns a controllable `Browser.runtime.Port`.
   */
  connect?: (info: { name: string }) => Browser.runtime.Port;
  /** Scheduler hooks. Default to `setTimeout`/`clearTimeout`. */
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Wall-clock source. Defaults to `Date.now`. */
  now?: () => number;
  /**
   * A connection that stays open at least this many ms before disconnecting is
   * treated as "stable" — the backoff index resets to 0 on the next drop.
   * Defaults to 5_000.
   */
  stableAfterMs?: number;
  /**
   * Backoff schedule in ms, indexed by consecutive failed attempts. The last
   * value repeats once exhausted. Defaults to `[0, 250, 1000, 5000]`.
   */
  backoffMs?: number[];
};

/**
 * Open a long-lived `runtime.Port` and keep it alive across service-worker
 * restarts by reconnecting with backoff whenever `onDisconnect` fires.
 *
 * @remarks
 * `wire` is called once per successful `connect()`, including on every
 * reconnect, with a brand-new port. The previous port (and any listeners
 * attached to it) is dropped; the caller's `wire` should re-attach against
 * the new port.
 *
 * The backoff sequence escalates on each consecutive disconnect and resets
 * to 0 once a connection has lasted `stableAfterMs`, so a transient SW
 * restart re-establishes immediately while a genuinely broken state doesn't
 * hammer `runtime.connect`.
 *
 * `close()` stops the loop and disconnects the active port; further
 * `onDisconnect` firings are ignored. Use this from `ctx.onInvalidated`.
 */
export function connectWithReconnect(
  name: string,
  wire: WireFn,
  options: ConnectOptions = {},
): Reconnector {
  const connectFn =
    options.connect ?? ((info) => browser.runtime.connect(info));
  const setTimer =
    options.setTimer ?? ((cb, ms) => setTimeout(cb, ms) as unknown);
  const clearTimer =
    options.clearTimer ?? ((handle) => clearTimeout(handle as number));
  const now = options.now ?? Date.now;
  const stableAfterMs = options.stableAfterMs ?? 5_000;
  const backoffMs = options.backoffMs ?? [0, 250, 1_000, 5_000];

  let stopped = false;
  let activePort: Browser.runtime.Port | null = null;
  let attemptIndex = 0;
  let connectedAt = 0;
  let retryHandle: unknown = null;

  const connect = (): void => {
    if (stopped) return;
    retryHandle = null;
    const port = connectFn({ name });
    activePort = port;
    connectedAt = now();

    port.onDisconnect.addListener(() => {
      // Stale disconnects (e.g. for an already-replaced port) are ignored.
      if (activePort !== port) return;
      activePort = null;
      if (stopped) return;

      const stable = now() - connectedAt >= stableAfterMs;
      if (stable) attemptIndex = 0;

      const delay = backoffMs[Math.min(attemptIndex, backoffMs.length - 1)] ?? 0;
      attemptIndex++;
      retryHandle = setTimer(connect, delay);
    });

    wire(port);
  };

  connect();

  return {
    close() {
      if (stopped) return;
      stopped = true;
      if (retryHandle !== null) clearTimer(retryHandle);
      retryHandle = null;
      const port = activePort;
      activePort = null;
      if (port) {
        try {
          port.disconnect();
        } catch {
          // Already disconnected — nothing to do.
        }
      }
    },
  };
}
