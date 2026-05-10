import { useEffect, useRef, useState } from "react";
import { excludedSites } from "./excluded-sites";

/**
 * React binding for the {@link excludedSites} storage item. Returns the
 * current list along with mutators that round-trip through storage so other
 * surfaces (popup, content script, options) observe the change.
 *
 * @remarks
 * Initial render returns an empty array while the value is being read from
 * storage. Use the `loaded` flag to distinguish "no exclusions yet" from
 * "still loading" so toggle UIs don't flash the wrong state.
 *
 * Mutators read from a ref tracking the latest list so back-to-back calls
 * within the same render cycle compose correctly instead of racing on a
 * stale `getValue()` snapshot.
 */
export function useExcludedSites() {
  const [sites, setSites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const sitesRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    excludedSites.getValue().then((value) => {
      if (cancelled) return;
      sitesRef.current = value;
      setSites(value);
      setLoaded(true);
    });
    const unwatch = excludedSites.watch((next) => {
      sitesRef.current = next;
      setSites(next);
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  const commit = (next: string[]) => {
    sitesRef.current = next;
    setSites(next);
    void excludedSites.setValue(next);
  };

  const add = (site: string) => {
    if (!site || sitesRef.current.includes(site)) return;
    commit([...sitesRef.current, site]);
  };

  const remove = (site: string) => {
    if (!sitesRef.current.includes(site)) return;
    commit(sitesRef.current.filter((s) => s !== site));
  };

  const setEnabled = (site: string, enabled: boolean) => {
    if (enabled) remove(site);
    else add(site);
  };

  return { sites, loaded, add, remove, setEnabled };
}
