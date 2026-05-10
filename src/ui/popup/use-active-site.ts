import { useEffect, useState } from "react";

/**
 * Resolve the hostname of the tab the popup is anchored to.
 *
 * @remarks
 * The popup is opened by clicking the toolbar pin while a tab is active, so
 * we look up the active tab in the current window. Returns `null` while the
 * lookup is in flight or when the tab has no addressable URL (e.g. the new
 * tab page).
 */
export function useActiveSite(): string | null {
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (cancelled) return;
        const url = tabs[0]?.url;
        if (!url) {
          setHost(null);
          return;
        }
        try {
          setHost(new URL(url).hostname);
        } catch {
          setHost(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return host;
}
