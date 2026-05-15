import { useSyncExternalStore } from "react";
import { settings, SETTINGS_DEFAULTS, type Settings } from "./settings";

type Snapshot = { value: Settings; loaded: boolean };

// Module-level state — one watcher per JS context regardless of how many
// components call `useSettings`. The previous per-mount implementation opened
// a fresh `storage.watch` on every consumer.
let snapshot: Snapshot = { value: SETTINGS_DEFAULTS, loaded: false };
const listeners = new Set<() => void>();
let attached = false;

const replace = (next: Snapshot): void => {
  snapshot = next;
  for (const listener of [...listeners]) listener();
};

const ensureWatcher = (): void => {
  if (attached) return;
  attached = true;
  void settings.getValue().then((stored) => {
    replace({ value: { ...SETTINGS_DEFAULTS, ...stored }, loaded: true });
  });
  settings.watch((next) => {
    replace({ value: { ...SETTINGS_DEFAULTS, ...next }, loaded: true });
  });
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): Snapshot => snapshot;

/**
 * React binding for the {@link settings} storage item. Returns the current
 * value plus an `update(patch)` mutator that round-trips through storage so
 * other surfaces observing the watcher stay in sync.
 *
 * @remarks
 * Backed by a module-singleton watcher: every consumer in this JS context
 * shares the same `storage.watch` callback and a single initial `getValue`,
 * so a page rendering N components calling `useSettings` does N=1 round-trip,
 * not N. Once a consumer mounts, the watcher stays attached for the lifetime
 * of the JS context.
 *
 * First render returns {@link SETTINGS_DEFAULTS} while the initial read is in
 * flight. Use the `loaded` flag to defer rendering of any control whose
 * visible state would flash if the user has overridden a default.
 *
 * Updates are merged against the latest snapshot so two patches dispatched
 * in the same tick compose correctly instead of racing on a stale value.
 */
export function useSettings() {
  ensureWatcher();
  const { value, loaded } = useSyncExternalStore(subscribe, getSnapshot);

  const update = (patch: Partial<Settings>): void => {
    const next: Settings = { ...snapshot.value, ...patch };
    replace({ value: next, loaded: snapshot.loaded });
    void settings.setValue(next);
  };

  return { settings: value, loaded, update };
}
