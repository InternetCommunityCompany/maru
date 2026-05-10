import { DEMO_STATS } from "@/ui/demo-data";

/**
 * Six-card grid of lifetime stats shown at the bottom of the settings page.
 * Demo numbers only — real values arrive once detection lands.
 */
export function StatsSection() {
  return (
    <div className="settings-section">
      <div className="section-heading">Your stats</div>
      <div className="stats-grid">
        {DEMO_STATS.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
