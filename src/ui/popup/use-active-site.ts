import { useEffect, useState } from "react";
import { canonicaliseHost } from "@/storage/canonicalise-host";

/**
 * Resolve the canonical hostname of the tab the popup is anchored to.
 *
 * @remarks
 * The popup is opened by clicking the toolbar pin while a tab is active, so
 * we look up the active tab in the current window. The URL is reduced to
 * the same canonical form used by the excluded-sites list, so the popup
 * toggle and the options-page list always agree on a key.
 *
 * Returns `null` while the lookup is in flight or when the tab has no
 * addressable URL (e.g. the new-tab page).
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
        const canonical = url ? canonicaliseHost(url) : "";
        setHost(canonical || null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return host;
}
