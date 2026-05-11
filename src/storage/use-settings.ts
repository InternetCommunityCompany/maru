import { useEffect, useRef, useState } from "react";
import { settings, SETTINGS_DEFAULTS, type Settings } from "./settings";

/**
 * React binding for the {@link settings} storage item. Returns the
 * current value plus an `update(patch)` mutator that round-trips through
 * storage so other surfaces observing the watcher stay in sync.
 *
 * @remarks
 * The first render returns {@link SETTINGS_DEFAULTS} while the storage
 * read is in flight. Use the `loaded` flag to defer rendering of any
 * controls whose visible state would flash if the user has overridden a
 * default.
 *
 * Every read shallow-merges the stored value over the defaults, so
 * fields added in a later release fill themselves in without a
 * versioned migration.
 *
 * Updates are merged against a ref tracking the latest value so two
 * patches dispatched in the same tick compose correctly instead of
 * racing on a stale snapshot.
 */
export function useSettings() {
  const [value, setValue] = useState<Settings>(SETTINGS_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const valueRef = useRef<Settings>(SETTINGS_DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    const apply = (stored: Settings | null) => {
      const merged = { ...SETTINGS_DEFAULTS, ...stored };
      valueRef.current = merged;
      setValue(merged);
    };
    settings.getValue().then((stored) => {
      if (cancelled) return;
      apply(stored);
      setLoaded(true);
    });
    const unwatch = settings.watch((next) => apply(next));
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...valueRef.current, ...patch };
    valueRef.current = next;
    setValue(next);
    void settings.setValue(next);
  };

  return { settings: value, loaded, update };
}
