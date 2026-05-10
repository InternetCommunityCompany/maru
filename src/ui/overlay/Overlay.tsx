import { useState } from "react";
import { BetterRateCard } from "./BetterRateCard";
import { ExecutingCard } from "./ExecutingCard";
import { FailedCard } from "./FailedCard";
import { Pill } from "./Pill";
import { SuccessCard } from "./SuccessCard";
import type { OverlayState, SwapMode } from "./types";

/** Props for the {@link Overlay} root component. */
export interface OverlayProps {
  /** State to start in. Defaults to `"better"` so the design lands open. */
  initial?: OverlayState;
  /** Swap mode — selects single-chain vs cross-chain copy / steps. */
  mode?: SwapMode;
}

/**
 * Root overlay component. Owns the local state machine that drives the
 * card / pill currently rendered in the bottom-right of the host page.
 *
 * @remarks
 * Mock-data only — no live swap detection yet. Action handlers transition
 * between states so designers can polish each surface in real conditions.
 * Once dismissed, the overlay stays hidden until the page is reloaded.
 */
export function Overlay({ initial = "better", mode = "swap" }: OverlayProps) {
  const [state, setState] = useState<OverlayState>(initial);

  if (state === "dismissed") return null;

  const dismiss = () => setState("dismissed");

  let body: React.ReactNode;
  switch (state) {
    case "scanning":
    case "all-good":
    case "working":
      body = <Pill variant={state} />;
      break;
    case "better":
    case "bridge":
      body = (
        <BetterRateCard
          mode={state === "bridge" ? "bridge" : mode}
          onDismiss={dismiss}
          onAccept={() => setState("executing")}
          onOpenRoute={dismiss}
        />
      );
      break;
    case "executing":
      body = (
        <ExecutingCard
          mode={mode}
          onDismiss={dismiss}
          onComplete={() => setState("success")}
        />
      );
      break;
    case "success":
      body = (
        <SuccessCard mode={mode} onDismiss={dismiss} onViewExplorer={dismiss} />
      );
      break;
    case "failed":
      body = <FailedCard onDismiss={dismiss} onRetry={() => setState("executing")} />;
      break;
  }

  return <div className="overlay">{body}</div>;
}
