import { useState } from "react";
import { Arbiter } from "./tabs/Arbiter";
import { Compare } from "./tabs/Compare";
import { useDebugStream } from "./use-debug-stream";

type TabKey = "templates" | "heuristics" | "arbiter" | "compare";

const TABS: { key: TabKey; label: string }[] = [
  { key: "templates", label: "Templates" },
  { key: "heuristics", label: "Heuristics" },
  { key: "arbiter", label: "Arbiter" },
  { key: "compare", label: "Compare" },
];

/**
 * Shell for the MARU DevTools panel. Owns the single debug-port subscription
 * and prop-drills the folded stream to each tab so all tabs see the same
 * event order regardless of mount timing.
 */
export function App() {
  const [active, setActive] = useState<TabKey>("arbiter");
  const stream = useDebugStream();

  return (
    <div>
      <nav>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            data-active={active === t.key || undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <section>
        {active === "arbiter" && <Arbiter stream={stream} />}
        {active === "compare" && <Compare stream={stream} />}
        {active === "templates" && <p>(Templates tab lands in MAR-100.)</p>}
        {active === "heuristics" && <p>(Heuristics tab lands in MAR-100.)</p>}
      </section>
    </div>
  );
}
