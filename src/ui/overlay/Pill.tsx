import { Maru } from "@/ui/mascot/Maru";
import type { MaruState } from "@/ui/mascot/state-sources";
import type { ReactNode } from "react";

/** The compact pill variants surfaced from the overlay state machine. */
export type PillVariant = "scanning" | "all-good" | "working";

/** Props for the {@link Pill} component. */
export interface PillProps {
  variant: PillVariant;
  /** Click handler — usually expands to the next overlay surface. */
  onClick?: () => void;
}

interface VariantConfig {
  className: string;
  mascot: MaruState;
  body: ReactNode;
}

const VARIANTS: Record<PillVariant, VariantConfig> = {
  scanning: {
    className: "ol-pill scanning",
    mascot: "searching",
    body: (
      <>
        Checking 7 sources
        <span className="dots">
          <span />
          <span />
          <span />
        </span>
      </>
    ),
  },
  "all-good": {
    className: "ol-pill good",
    mascot: "thumbs-up",
    body: (
      <>
        You&apos;ve got the best rate <span className="check">✓</span>
      </>
    ),
  },
  working: {
    className: "ol-pill working",
    mascot: "searching",
    body: <>Working… don&apos;t refresh</>,
  },
};

/**
 * Compact pill used for quiet overlay states (scanning, best-rate, working).
 * Three variants share layout but differ in mascot, copy, and animation.
 */
export function Pill({ variant, onClick }: PillProps) {
  const config = VARIANTS[variant];
  return (
    <button className={config.className} onClick={onClick}>
      <span className="ol-pill-maru">
        <Maru state={config.mascot} size={22} />
      </span>
      <span className="ol-pill-text">{config.body}</span>
    </button>
  );
}
