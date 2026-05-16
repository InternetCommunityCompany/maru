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
 * React binding for {@link excludedSites}. Initial render returns `[]` while
 * the read is in flight — use `loaded` to distinguish "empty" from "loading"
 * in toggle UIs.
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
