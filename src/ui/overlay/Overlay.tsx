import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AlertCardViewModel, AlertViewModel } from "@/alert-feed/types";
import { BetterRateCard } from "./BetterRateCard";
import { ExecutingCard } from "./ExecutingCard";
import { FailedCard } from "./FailedCard";
import { Pill } from "./Pill";
import { SuccessCard } from "./SuccessCard";

type LocalState = "alert" | "executing" | "success" | "failed";

/** Props for the {@link Overlay} root component. */
export interface OverlayProps {
  /** Live alert state for this tab. `null` hides the surface. */
  alert: AlertViewModel | null;
}

/**
 * Root overlay component. Rendering is driven by the background-owned alert
 * view model; local state is limited to per-page dismissal and execution
 * stubs until the real execution flow lands.
 */
export function Overlay({ alert }: OverlayProps) {
  const [dismissedSessions, setDismissedSessions] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [localState, setLocalState] = useState<LocalState>("alert");

  const card = alert && "card" in alert ? alert.card : null;
  const sessionKey = card?.sessionKey ?? null;

  useEffect(() => {
    setLocalState("alert");
  }, [sessionKey]);

  const isDismissed = useMemo(
    () => sessionKey !== null && dismissedSessions.has(sessionKey),
    [dismissedSessions, sessionKey],
  );

  if (!alert || isDismissed) return null;

  const dismiss = () => {
    if (!sessionKey) return;
    setDismissedSessions((previous) => new Set(previous).add(sessionKey));
  };

  let body: ReactNode;
  switch (alert.state) {
    case "scanning":
    case "all-good":
      body = <Pill variant={alert.state} sourceCount={alert.sourceCount} />;
      break;
    case "better":
    case "bridge":
      if (localState === "executing") {
        body = (
          <ExecutingCard
            mode={alert.card.mode}
            route={alert.card.route}
            onDismiss={dismiss}
            onComplete={() => setLocalState("success")}
          />
        );
        break;
      }
      if (localState === "success") {
        body = (
          <SuccessCard
            card={alert.card}
            onDismiss={dismiss}
            onViewExplorer={dismiss}
          />
        );
        break;
      }
      if (localState === "failed") {
        body = (
          <FailedCard
            mode={alert.card.mode}
            onDismiss={dismiss}
            onRetry={() => setLocalState("executing")}
          />
        );
        break;
      }
      body = renderAlertCard(alert.card, dismiss, () => setLocalState("executing"));
      break;
  }

  return <div className="overlay">{body}</div>;
}

function renderAlertCard(
  card: AlertCardViewModel,
  dismiss: () => void,
  accept: () => void,
): ReactNode {
  return (
    <BetterRateCard
      card={card}
      onDismiss={dismiss}
      onAccept={accept}
      onOpenRoute={dismiss}
    />
  );
}
