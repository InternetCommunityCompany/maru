import { Fragment, useEffect, useRef, useState } from "react";
import { cx } from "@/ui/cx";
import type { AlertSwapMode } from "@/alert-feed/types";
import { Wordmark } from "./Wordmark";

/** Props for the {@link ExecutingCard} component. */
export interface ExecutingCardProps {
  /** Whether the execution is for a swap or a bridge. */
  mode: AlertSwapMode;
  /** Route label selected by the alert feed. */
  route: string;
  /** Dismiss handler invoked when the user closes the card mid-flight. */
  onDismiss: () => void;
  /** Fired once the final step lands so the host can transition to success. */
  onComplete?: () => void;
}

const SWAP_STEPS = ["Approve", "Sign", "Confirm", "Done"] as const;
const BRIDGE_STEPS = ["Approve", "Source", "Bridging", "Done"] as const;

/**
 * Card showing the live progress of an in-flight swap or bridge. Steps
 * advance on a 1.1s interval — once the last step completes, `onComplete`
 * fires so the parent can swap in the success card.
 */
export function ExecutingCard({ mode, route, onDismiss, onComplete }: ExecutingCardProps) {
  const labels = mode === "bridge" ? BRIDGE_STEPS : SWAP_STEPS;
  const [step, setStep] = useState(0);

  // Re-rendering parents typically pass a fresh `onComplete` arrow each
  // render; stash the latest one in a ref so the completion timer doesn't
  // tear down and re-arm on every keystroke.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (step >= labels.length) return;
    const timer = setTimeout(() => {
      setStep((current) => current + 1);
    }, 1100);
    return () => clearTimeout(timer);
  }, [step, labels.length]);

  useEffect(() => {
    if (step < labels.length) return;
    const timer = setTimeout(() => onCompleteRef.current?.(), 600);
    return () => clearTimeout(timer);
  }, [step, labels.length]);

  return (
    <div className="overlay-card big">
      <div className="ol-header">
        <Wordmark />
        <button className="ol-close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="ol-headline">
        Routing through <strong>{route}</strong>. Confirm in your wallet — I&apos;ll handle
        the rest.
      </div>
      <div className="ol-steps">
        {labels.map((label, i) => {
          const status = i < step ? "done" : i === step ? "active" : undefined;
          return (
            <Fragment key={label}>
              {i > 0 && <div className={cx("ol-step-line", i <= step && "done")} />}
              <div className={cx("ol-step", status)}>
                <div className="ol-step-dot">{i < step ? "✓" : i + 1}</div>
                <div className="ol-step-label">{label}</div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
