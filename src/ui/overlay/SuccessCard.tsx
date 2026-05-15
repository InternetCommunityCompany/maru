import { Maru } from "@/ui/mascot/Maru";
import type { AlertCardViewModel } from "@/alert-feed/types";
import { Wordmark } from "./Wordmark";

/** Props for the {@link SuccessCard} component. */
export interface SuccessCardProps {
  /** Route and token data from the accepted alert. */
  card: AlertCardViewModel;
  /** Dismiss handler invoked when the user closes the celebration. */
  onDismiss: () => void;
  /** Open the explorer link for this transaction (no-op stub for now). */
  onViewExplorer: () => void;
}

/**
 * Celebration card shown after a swap/bridge lands. Big savings amount,
 * dancing Maru, and explorer / close actions.
 */
export function SuccessCard({ card, onDismiss, onViewExplorer }: SuccessCardProps) {
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
          <div className="ol-success-eyebrow">Better route complete</div>
          <div className="ol-success-amount">
            {card.destination.amount} {card.destination.token.sym}
          </div>
          <div className="ol-success-sub">via {card.route}</div>
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
