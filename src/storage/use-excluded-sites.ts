import { useEffect, useState } from "react";
import { excludedSites } from "./excluded-sites";

/**
 * React binding for the {@link excludedSites} storage item. Returns the
 * current list along with mutators that round-trip through storage so other
 * surfaces (popup, content script, options) observe the change.
 *
 * @remarks
 * Initial render returns an empty array while the value is being read from
 * storage. Use the boolean `loaded` flag to distinguish "no exclusions yet"
 * from "still loading."
 */
export function useExcludedSites() {
  const [sites, setSites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    excludedSites.getValue().then((value) => {
      if (cancelled) return;
      setSites(value);
      setLoaded(true);
    });
    const unwatch = excludedSites.watch((next) => setSites(next));
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  const add = (site: string) => {
    if (!site) return;
    void excludedSites.getValue().then((current) => {
      if (current.includes(site)) return;
      void excludedSites.setValue([...current, site]);
    });
  };

  const remove = (site: string) => {
    void excludedSites.getValue().then((current) => {
      void excludedSites.setValue(current.filter((s) => s !== site));
    });
  };

  const setEnabled = (site: string, enabled: boolean) => {
    if (enabled) remove(site);
    else add(site);
  };

  return { sites, loaded, add, remove, setEnabled };
}
