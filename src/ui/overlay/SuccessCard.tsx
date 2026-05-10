import { Maru } from "@/ui/mascot/Maru";
import type { SwapMode } from "./types";
import { Wordmark } from "./Wordmark";

/** Props for the {@link SuccessCard} component. */
export interface SuccessCardProps {
  /** Whether the user just completed a swap or a bridge. */
  mode: SwapMode;
  /** Dismiss handler invoked when the user closes the celebration. */
  onDismiss: () => void;
  /** Open the explorer link for this transaction (no-op stub for now). */
  onViewExplorer: () => void;
}

/**
 * Celebration card shown after a swap/bridge lands. Big savings amount,
 * dancing Maru, and explorer / close actions.
 */
export function SuccessCard({ mode, onDismiss, onViewExplorer }: SuccessCardProps) {
  const savings = mode === "bridge" ? "4.62" : "10.18";
  return (
    <div className="overlay-card big success">
      <div className="ol-header">
        <Wordmark />
        <button className="ol-close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="ol-success-body">
        <div className="ol-success-maru">
          <Maru state="dancing" size={64} />
        </div>
        <div>
          <div className="ol-success-eyebrow">You just saved</div>
          <div className="ol-success-amount">${savings}</div>
          <div className="ol-success-sub">vs. the rate you would&apos;ve gotten</div>
        </div>
      </div>
      <div className="ol-actions">
        <button className="ol-btn dismiss" onClick={onDismiss}>
          Close
        </button>
        <button className="ol-btn primary" onClick={onViewExplorer}>
          View on explorer
        </button>
      </div>
    </div>
  );
}
