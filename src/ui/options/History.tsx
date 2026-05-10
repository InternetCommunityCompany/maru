import { Maru } from "@/ui/mascot/Maru";
import { PanelClose } from "./PanelClose";

/** Props for the {@link History} panel. */
export interface HistoryProps {
  /** Close handler. Renders the × button when provided. */
  onClose?: () => void;
}

interface HistoryRow {
  pair: string;
  when: string;
  via: string;
  saved: string;
  pct: string;
}

const DEMO_HISTORY: HistoryRow[] = [
  { pair: "USDC → ETH", when: "2h ago", via: "1inch", saved: "$10.18", pct: "+0.32%" },
  { pair: "ETH → ARB", when: "yesterday", via: "Stargate", saved: "$4.62", pct: "+0.46%" },
  { pair: "DAI → USDC", when: "3 days ago", via: "CowSwap", saved: "$1.04", pct: "+0.10%" },
  { pair: "USDC → SOL", when: "5 days ago", via: "Mayan", saved: "$22.40", pct: "+0.89%" },
  { pair: "WETH → ETH", when: "1 week ago", via: "Paraswap", saved: "$0.81", pct: "+0.04%" },
  { pair: "MATIC → USDC", when: "1 week ago", via: "Odos", saved: "$3.21", pct: "+0.16%" },
  { pair: "USDC → ETH", when: "2 weeks ago", via: "1inch", saved: "$8.40", pct: "+0.28%" },
  { pair: "ARB → ETH", when: "3 weeks ago", via: "Across", saved: "$15.20", pct: "+0.51%" },
];

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
          <div className="hist-hero-value">$247.80</div>
          <div className="hist-hero-label">Lifetime saved across 23 swaps</div>
        </div>
        <div className="hist-hero-grid">
          <div>
            <div className="hist-hero-grid-value">$10.77</div>
            <div className="hist-hero-grid-label">Avg / swap</div>
          </div>
          <div>
            <div className="hist-hero-grid-value">$22.40</div>
            <div className="hist-hero-grid-label">Best save</div>
          </div>
          <div>
            <div className="hist-hero-grid-value">68d</div>
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
