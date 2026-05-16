import { useState } from "react";
import { useDebugStream } from "./use-debug-stream";

type TabKey = "templates" | "heuristics" | "arbiter" | "compare";

const TABS: { key: TabKey; label: string }[] = [
  { key: "templates", label: "Templates" },
  { key: "heuristics", label: "Heuristics" },
  { key: "arbiter", label: "Arbiter" },
  { key: "compare", label: "Compare" },
];

/**
 * Shell for the MARU DevTools panel. Renders four named placeholder tabs;
 * the actual tab bodies land in sibling tasks (MAR-99/MAR-100). The debug
 * port subscription is wired here so the event log is ready as soon as the
 * first tab implementation needs it.
 */
export function App() {
  const [active, setActive] = useState<TabKey>("templates");
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
        <p>
          Tab: <strong>{active}</strong> · events received:{" "}
          {stream.events.length}
        </p>
        <p>(Tab content lands in MAR-99/MAR-100.)</p>
      </section>
    </div>
  );
}
