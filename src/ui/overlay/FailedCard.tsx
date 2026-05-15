import type { AlertSwapMode } from "@/alert-feed/types";
import { Wordmark } from "./Wordmark";

/** Props for the {@link FailedCard} component. */
export interface FailedCardProps {
  /** Whether the failed attempt was a swap or bridge. */
  mode: AlertSwapMode;
  /** User cancelled the retry flow. */
  onDismiss: () => void;
  /** User wants to retry — typically transitions back to the executing card. */
  onRetry: () => void;
}

/**
 * Failure card. Reassures the user funds are safe, names the failure mode,
 * and offers a retry CTA. Uses the system error palette (red soft).
 */
export function FailedCard({ mode, onDismiss, onRetry }: FailedCardProps) {
  return (
    <div className="overlay-card big">
      <div className="ol-header">
        <Wordmark />
        <button className="ol-close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="ol-headline">
        Pool moved before we could land it.{" "}
        <span className="muted">Your funds are safe.</span>
      </div>
      <div className="ol-error-box">
        <div className="ol-error-label">Slippage exceeded</div>
        <div className="ol-error-message">
          Price shifted 0.8% mid-tx. Retry with higher tolerance?
        </div>
      </div>
      <div className="ol-actions">
        <button className="ol-btn dismiss" onClick={onDismiss}>
          Cancel
        </button>
        <button className="ol-btn primary" onClick={onRetry}>
          Retry {mode}
        </button>
      </div>
    </div>
  );
}
