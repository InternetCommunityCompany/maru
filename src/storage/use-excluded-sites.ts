import { useSyncExternalStore } from "react";
import { excludedSites } from "./excluded-sites";

type Snapshot = { value: string[]; loaded: boolean };

// Module-level state — one watcher per JS context regardless of how many
// components call `useExcludedSites`.
let snapshot: Snapshot = { value: [], loaded: false };
const listeners = new Set<() => void>();
let attached = false;

const replace = (next: Snapshot): void => {
  snapshot = next;
  for (const listener of [...listeners]) listener();
};

const ensureWatcher = (): void => {
  if (attached) return;
  attached = true;
  void excludedSites.getValue().then((value) => {
    replace({ value, loaded: true });
  });
  excludedSites.watch((next) => {
    replace({ value: next, loaded: true });
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
 * React binding for the {@link excludedSites} storage item. Returns the
 * current list along with mutators that round-trip through storage so other
 * surfaces (popup, content script, options) observe the change.
 *
 * @remarks
 * Backed by a module-singleton watcher: every consumer shares the same
 * `storage.watch` callback. The previous per-mount implementation opened a
 * fresh watcher on every consumer.
 *
 * Initial render returns an empty array while the value is being read. Use
 * the `loaded` flag to distinguish "no exclusions yet" from "still loading"
 * so toggle UIs don't flash the wrong state.
 *
 * Mutators read from the latest snapshot so back-to-back calls within the
 * same render cycle compose correctly instead of racing on a stale value.
 */
export function useExcludedSites() {
  ensureWatcher();
  const { value: sites, loaded } = useSyncExternalStore(subscribe, getSnapshot);

  const commit = (next: string[]): void => {
    replace({ value: next, loaded: snapshot.loaded });
    void excludedSites.setValue(next);
  };

  const add = (site: string): void => {
    if (!site || snapshot.value.includes(site)) return;
    commit([...snapshot.value, site]);
  };

  const remove = (site: string): void => {
    if (!snapshot.value.includes(site)) return;
    commit(snapshot.value.filter((s) => s !== site));
  };

  const setEnabled = (site: string, enabled: boolean): void => {
    if (enabled) remove(site);
    else add(site);
  };

  return { sites, loaded, add, remove, setEnabled };
}
