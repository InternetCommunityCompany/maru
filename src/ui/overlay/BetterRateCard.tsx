import { TokenChip } from "./TokenChip";
import { TOKEN_CATALOGUE } from "./tokens";
import type { SwapMode } from "./types";
import { Wordmark } from "./Wordmark";

/** Props for the {@link BetterRateCard} component. */
export interface BetterRateCardProps {
  /** Whether the better rate is on a single-chain swap or a bridge. */
  mode: SwapMode;
  /** User dismissed the overlay (× icon). */
  onDismiss: () => void;
  /** User accepted MARU's better route. */
  onAccept: () => void;
  /** User opted out — open the suggested route's own dapp instead. */
  onOpenRoute: () => void;
}

/**
 * Big card surfacing a better swap or bridge rate. Conversational headline,
 * source → destination token strip, primary "Use better rate" CTA, and a
 * secondary "Open in {route}" button stacked underneath.
 */
export function BetterRateCard({ mode, onDismiss, onAccept, onOpenRoute }: BetterRateCardProps) {
  const isBridge = mode === "bridge";
  const pct = isBridge ? "0.46" : "2.7";
  const route = isBridge ? "Stargate" : "1inch";
  const src = TOKEN_CATALOGUE.USDC;
  const dst = isBridge ? TOKEN_CATALOGUE.ARB : TOKEN_CATALOGUE.ETH;
  const dstAmount = isBridge ? "100.46" : "0.03174";

  return (
    <div className="overlay-card big">
      <div className="ol-header">
        <Wordmark />
        <button className="ol-close" onClick={onDismiss} title="Dismiss" aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="ol-headline">
        I can save you <span className="green">~{pct}%</span> by going through{" "}
        <strong>{route}</strong> instead.
      </div>
      <div className="ol-token-row">
        <TokenChip token={src} amount="100" />
        <span className="ol-arrow">→</span>
        <TokenChip token={dst} amount={dstAmount} reverse highlight />
      </div>
      <div className="ol-actions stacked">
        <button className="ol-btn primary full" onClick={onAccept}>
          Use better rate
        </button>
        <button className="ol-btn dismiss full" onClick={onOpenRoute}>
          Open in {route}
        </button>
      </div>
    </div>
  );
}
