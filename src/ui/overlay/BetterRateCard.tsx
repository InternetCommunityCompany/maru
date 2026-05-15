import type { ReactNode } from "react";
import type { AlertCardViewModel } from "@/alert-feed/types";
import { TokenChip } from "./TokenChip";
import { Wordmark } from "./Wordmark";

/** Props for the {@link BetterRateCard} component. */
export interface BetterRateCardProps {
  /** Live card data produced by the alert feed. */
  card: AlertCardViewModel;
  /** User dismissed the overlay (x icon). */
  onDismiss: () => void;
  /** User accepted MARU's better route. */
  onAccept: () => void;
  /** User opted out — open the suggested route's own dapp instead. */
  onOpenRoute: () => void;
}

/**
 * Big card surfacing a better swap or bridge route. The component is display
 * only; route, amounts, tokens, and confidence are provided by the feed.
 */
export function BetterRateCard({
  card,
  onDismiss,
  onAccept,
  onOpenRoute,
}: BetterRateCardProps) {
  return (
    <div className="overlay-card big">
      <div className="ol-header">
        <Wordmark />
        <button className="ol-close" onClick={onDismiss} title="Dismiss" aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="ol-headline">{headline(card)}</div>
      <div className="ol-token-row">
        <TokenChip token={card.source.token} amount={card.source.amount} />
        <span className="ol-arrow">→</span>
        <TokenChip
          token={card.destination.token}
          amount={card.destination.amount}
          reverse
          highlight
        />
      </div>
      <div className="ol-actions stacked">
        <button className="ol-btn primary full" onClick={onAccept}>
          Use better rate
        </button>
        <button className="ol-btn dismiss full" onClick={onOpenRoute}>
          Open in {card.route}
        </button>
      </div>
    </div>
  );
}

function headline(card: AlertCardViewModel): ReactNode {
  if (card.savingsPercent) {
    return (
      <>
        I can save you <span className="green">~{card.savingsPercent}%</span> by going
        through <strong>{card.route}</strong> instead.
      </>
    );
  }

  return (
    <>
      I found a live {card.mode === "bridge" ? "bridge" : "swap"} route through{" "}
      <strong>{card.route}</strong>.
    </>
  );
}
