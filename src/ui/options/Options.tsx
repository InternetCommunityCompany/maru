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
 */
export function Options() {
  const [panel, setPanel] = useState<Panel>(readPanel);

  useEffect(() => {
    const onHashChange = () => setPanel(readPanel());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const onClose = () => window.close();

  return (
    <div className="options-shell">
      {panel === "history" ? <History onClose={onClose} /> : <Settings onClose={onClose} />}
    </div>
  );
}
