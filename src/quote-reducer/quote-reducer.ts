import type { QuoteUpdate, SessionKey } from "@/arbiter/types";
import type {
  QuoteReducer,
  QuoteReducerChange,
  QuoteReducerListener,
  QuoteReducerOptions,
} from "./types";

/**
 * Default idle TTL — a session that has not received an update for this many
 * milliseconds is evicted.
 *
 * Generous on purpose: aggregator UIs can sit idle for a while between
 * refreshes and we don't want to drop the user's last visible quote in the
 * middle of them reading it.
 */
export const DEFAULT_TTL_MS = 60_000;

/**
 * Build a session-keyed reducer over the `QuoteUpdate` wire stream.
 *
 * Maintains one current-best entry per `sessionKey`, replaces it only on a
 * strictly-greater `sequence`, and evicts idle sessions after `ttlMs`.
 * Subscribers receive `added` / `updated` / `evicted` changes; `get` and
 * `snapshot` provide pull-style reads for consumers (e.g. a future popup or
 * overlay) that mount after the first emissions have already arrived.
 *
 * @remarks
 * The reducer is intentionally pure — it does not log on its own. Wire a
 * logging subscriber if you want change-only console output (the background
 * entrypoint does this). Keeping logging external makes the reducer trivial
 * to unit-test without stubbing globals.
 */
export function createQuoteReducer(
  options: QuoteReducerOptions = {},
): QuoteReducer {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const map = new Map<SessionKey, QuoteUpdate>();
  const timers = new Map<SessionKey, ReturnType<typeof setTimeout>>();
  const listeners = new Set<QuoteReducerListener>();

  const fire = (change: QuoteReducerChange) => {
    for (const listener of listeners) {
      try {
        listener(change);
      } catch {
        // a subscriber's throw must not block delivery to other subscribers
      }
    }
  };

  const armTimer = (sessionKey: SessionKey) => {
    const existing = timers.get(sessionKey);
    if (existing !== undefined) clearTimeout(existing);
    const handle = setTimeout(() => {
      const last = map.get(sessionKey);
      if (!last) return;
      map.delete(sessionKey);
      timers.delete(sessionKey);
      fire({ type: "evicted", sessionKey, update: last });
    }, ttlMs);
    timers.set(sessionKey, handle);
  };

  return {
    ingest(update) {
      const sessionKey = update.sessionKey;
      const previous = map.get(sessionKey);
      if (previous === undefined) {
        map.set(sessionKey, update);
        armTimer(sessionKey);
        fire({ type: "added", sessionKey, update });
        return;
      }
      if (update.sequence <= previous.sequence) {
        // out-of-order or duplicate — drop without firing
        return;
      }
      map.set(sessionKey, update);
      armTimer(sessionKey);
      fire({ type: "updated", sessionKey, update, previous });
    },

    get(sessionKey) {
      return map.get(sessionKey);
    },

    snapshot() {
      return new Map(map);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      for (const handle of timers.values()) clearTimeout(handle);
      timers.clear();
      map.clear();
      listeners.clear();
    },
  };
}
