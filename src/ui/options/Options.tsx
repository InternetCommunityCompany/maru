import { useEffect, useState } from "react";
import { History } from "./History";
import { Settings } from "./Settings";

type Panel = "settings" | "history";

function readPanel(): Panel {
  return window.location.hash.replace(/^#/, "") === "history" ? "history" : "settings";
}

/**
 * Options-page root. Renders either the Settings or History panel based on
 * `location.hash`. The popup deep-links here via `#settings` / `#history`.
 *
 * @remarks
 * No close handler is threaded through — the page lives in its own tab,
 * which `window.close()` can't dismiss when opened by `tabs.create`. The
 * panels' `onClose` prop is reserved for future modal usage inside the
 * overlay shadow root.
 */
export function Options() {
  const [panel, setPanel] = useState<Panel>(readPanel);

  useEffect(() => {
    const onHashChange = () => setPanel(readPanel());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className="options-shell">
      {panel === "history" ? <History /> : <Settings />}
    </div>
  );
}
