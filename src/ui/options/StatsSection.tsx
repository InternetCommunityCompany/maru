interface Stat {
  v: string;
  l: string;
}

const DEMO_STATS: Stat[] = [
  { v: "$247.80", l: "Lifetime saved" },
  { v: "23", l: "Swaps optimized" },
  { v: "$10.77", l: "Avg per swap" },
  { v: "$22.40", l: "Best save" },
  { v: "68d", l: "Active streak" },
  { v: "0.31%", l: "Avg improvement" },
];

/**
 * Six-card grid of lifetime stats shown at the bottom of the settings page.
 * Demo numbers only — real values arrive once detection lands.
 */
export function StatsSection() {
  return (
    <div className="settings-section">
      <div className="section-heading">Your stats</div>
      <div className="stats-grid">
        {DEMO_STATS.map((s) => (
          <div key={s.l} className="stat-card">
            <div className="stat-value">{s.v}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
