/** Called once per successful connect, including reconnects, with a fresh port. */
export type WireFn = (port: Browser.runtime.Port) => void;

export type Reconnector = {
  /** Stop the loop and disconnect. Idempotent. Use from `ctx.onInvalidated`. */
  close(): void;
};

export type ConnectOptions = {
  /** Test seam — defaults to `browser.runtime.connect`. */
  connect?: (info: { name: string }) => Browser.runtime.Port;
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  now?: () => number;
  /** Connection lasting at least this long resets the backoff index. Default 5_000. */
  stableAfterMs?: number;
  /** Backoff schedule; the last value repeats once exhausted. Default `[0, 250, 1000, 5000]`. */
  backoffMs?: number[];
};

/**
 * Open a long-lived `runtime.Port` and reconnect with backoff on disconnect.
 * The `wire` callback is re-invoked against each fresh port — callers must
 * re-attach their listeners there. Backoff resets after a connection lasts
 * `stableAfterMs`, so a transient SW restart re-establishes immediately
 * while a broken state doesn't hammer `runtime.connect`.
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
