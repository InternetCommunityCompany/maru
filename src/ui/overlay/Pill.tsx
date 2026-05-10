import { Maru } from "@/ui/mascot/Maru";

/** The compact pill variants surfaced from the overlay state machine. */
export type PillVariant = "scanning" | "all-good" | "working";

/** Props for the {@link Pill} component. */
export interface PillProps {
  variant: PillVariant;
  /** Click handler — usually expands to the next overlay surface. */
  onClick?: () => void;
}

/**
 * Compact pill used for quiet overlay states (scanning, best-rate, working).
 * Three variants share layout but differ in mascot, copy, and animation.
 */
export function Pill({ variant, onClick }: PillProps) {
  if (variant === "scanning") {
    return (
      <button className="ol-pill scanning" onClick={onClick}>
        <span className="ol-pill-maru">
          <Maru state="searching" size={22} />
        </span>
        <span className="ol-pill-text">
          Checking 7 sources
          <span className="dots">
            <span />
            <span />
            <span />
          </span>
        </span>
      </button>
    );
  }
  if (variant === "all-good") {
    return (
      <button className="ol-pill good" onClick={onClick}>
        <span className="ol-pill-maru">
          <Maru state="thumbs-up" size={22} />
        </span>
        <span className="ol-pill-text">
          You&apos;ve got the best rate <span className="check">✓</span>
        </span>
      </button>
    );
  }
  return (
    <button className="ol-pill working" onClick={onClick}>
      <span className="ol-pill-maru">
        <Maru state="searching" size={22} />
      </span>
      <span className="ol-pill-text">Working… don&apos;t refresh</span>
    </button>
  );
}
