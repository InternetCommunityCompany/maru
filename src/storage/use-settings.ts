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
 * React binding for {@link settings}. First render returns
 * {@link SETTINGS_DEFAULTS} while the initial read is in flight — gate any
 * control whose visible state would flash on `loaded`.
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
