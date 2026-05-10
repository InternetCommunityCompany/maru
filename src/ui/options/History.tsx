import { DEMO_HISTORY, DEMO_LIFETIME } from "@/ui/demo-data";
import { Maru } from "@/ui/mascot/Maru";
import { PanelClose } from "./PanelClose";

/** Props for the {@link History} panel. */
export interface HistoryProps {
  /** Close handler. Renders the × button when provided. */
  onClose?: () => void;
}

/**
 * History panel. Lifetime hero strip across the top with avg/best/streak
 * stats, then a row-per-trade list below. Demo data only for now.
 */
export function History({ onClose }: HistoryProps) {
  return (
    <div className="history">
      <div className="history-head">
        <div className="options-brand">
          <Maru state="thumbs-up" size={32} />
          <span className="options-wordmark">MARU</span>
          <span className="options-tagline">History</span>
        </div>
        {onClose && <PanelClose onClose={onClose} />}
      </div>
      <div className="hist-hero">
        <div>
          <div className="hist-hero-value">{DEMO_LIFETIME.total}</div>
          <div className="hist-hero-label">
            Lifetime saved across {DEMO_LIFETIME.swaps} swaps
          </div>
        </div>
        <div className="hist-hero-grid">
          <div>
            <div className="hist-hero-grid-value">{DEMO_LIFETIME.avgPerSwap}</div>
            <div className="hist-hero-grid-label">Avg / swap</div>
          </div>
          <div>
            <div className="hist-hero-grid-value">{DEMO_LIFETIME.bestSave}</div>
            <div className="hist-hero-grid-label">Best save</div>
          </div>
          <div>
            <div className="hist-hero-grid-value">{DEMO_LIFETIME.streak}</div>
            <div className="hist-hero-grid-label">Streak</div>
          </div>
        </div>
      </div>
      <div className="hist-list">
        {DEMO_HISTORY.map((row, i) => (
          <div key={i} className="hist-row">
            <div>
              <div className="hist-row-pair">{row.pair}</div>
              <div className="hist-row-meta">
                {row.when} · via <strong>{row.via}</strong>
              </div>
            </div>
            <div className="hist-row-right">
              <div className="hist-row-saved">+{row.saved}</div>
              <div className="hist-row-percent">{row.pct}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
