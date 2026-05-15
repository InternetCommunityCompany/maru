import type { TokenSide } from "./types";
import { TokenChip } from "./TokenChip";
import { Wordmark } from "./Wordmark";

/** Props for the {@link BetterRateCard} component. */
export interface BetterRateCardProps {
  /** Relative delta, percent. `null` when the dapp's `amountOut` was zero. */
  percentage: number | null;
  /** Provider / route label shown on the headline. */
  route: string;
  /** Source-token side of the trade. */
  src: TokenSide;
  /** Destination-token side of the trade — highlighted (the saved-on leg). */
  dst: TokenSide;
  /** User dismissed the overlay (× icon). */
  onDismiss: () => void;
  /** User accepted MARU's better route. */
  onAccept: () => void;
  /** User opted out — open the suggested route's own dapp instead. */
  onOpenRoute: () => void;
}

/** Format percent for headline display. `null` → "—". */
function formatPercent(percentage: number | null): string {
  if (percentage === null) return "—";
  // One decimal place is fine for V1 — MAR-33 owns precise rounding rules.
  return `${percentage.toFixed(percentage >= 10 ? 1 : 2)}`;
}

/**
 * Big card surfacing a better swap or bridge rate. Conversational headline,
 * source → destination token strip, primary "Use better rate" CTA, and a
 * secondary "Open in {route}" button stacked underneath.
 *
 * @remarks
 * Cross-chain is rendered uniformly with same-chain — the only visual
 * difference is the chain badge `TokenChip` paints on each side's icon
 * disc when `chainId` is set. Headline copy, button stack, and layout are
 * identical across swap and bridge.
 */
export function BetterRateCard({
  percentage,
  route,
  src,
  dst,
  onDismiss,
  onAccept,
  onOpenRoute,
}: BetterRateCardProps) {
  const isCrossChain = src.chainId !== dst.chainId;
  return (
    <div className="overlay-card big">
      <div className="ol-header">
        <Wordmark />
        <button className="ol-close" onClick={onDismiss} title="Dismiss" aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="ol-headline">
        I can save you <span className="green">~{formatPercent(percentage)}%</span> by going through{" "}
        <strong>{route}</strong> instead.
      </div>
      <div className="ol-token-row">
        <TokenChip
          token={src.token}
          amount={src.amount}
          chainId={isCrossChain ? src.chainId : undefined}
        />
        <span className="ol-arrow">→</span>
        <TokenChip
          token={dst.token}
          amount={dst.amount}
          chainId={isCrossChain ? dst.chainId : undefined}
          reverse
          highlight
        />
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
