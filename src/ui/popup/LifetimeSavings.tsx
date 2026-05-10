/** Props for the {@link LifetimeSavings} hero strip. */
export interface LifetimeSavingsProps {
  /** Formatted total savings (currency string, e.g. `"$247.80"`). */
  total: string;
  /** Number of swaps the total covers. */
  swaps: number;
  /** Streak label (e.g. `"68d"`). */
  streak: string;
}

/**
 * Lifetime savings hero block on the popup — big cumulative number on the
 * left, small swaps/streak stats on the right.
 */
export function LifetimeSavings({ total, swaps, streak }: LifetimeSavingsProps) {
  return (
    <div className="popup-savings">
      <div>
        <div className="popup-savings-value">{total}</div>
        <div className="popup-savings-label">Lifetime saved</div>
      </div>
      <div className="popup-savings-stats">
        <div className="popup-stat">
          <div className="popup-stat-value">{swaps}</div>
          <div className="popup-stat-label">Swaps</div>
        </div>
        <div className="popup-stat">
          <div className="popup-stat-value">{streak}</div>
          <div className="popup-stat-label">Streak</div>
        </div>
      </div>
    </div>
  );
}
