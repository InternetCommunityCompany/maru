import { useSyncExternalStore } from "react";
import { BetterRateCard } from "./BetterRateCard";
import { Pill } from "./Pill";
import { snapshotToView } from "./snapshot-to-view";
import type { SnapshotStore } from "./snapshot-store";

/** Props for the {@link Overlay} root component. */
export interface OverlayProps {
  /** Source of the current `ComparisonSnapshot`. The overlay subscribes to its changes. */
  store: SnapshotStore;
}

/**
 * Root overlay component. Subscribes to the snapshot store, maps the
 * current `ComparisonSnapshot` onto an `OverlayView` via
 * {@link snapshotToView}, and renders either nothing, a compact pill, or
 * the full better-rate card.
 *
 * @remarks
 * Dismissal stickiness, debounce, and execution-side cards (executing /
 * success / failed) are out of scope here — they're driven by sibling
 * issues (MAR-32 / Better-Rate Execution project).
 */
export function Overlay({ store }: OverlayProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  const view = snapshotToView(snapshot);
  if (view === null) return null;

  const noop = () => {};

  return (
    <div className="overlay">
      {view.kind === "pill" ? (
        <Pill variant={view.variant} />
      ) : (
        <BetterRateCard
          percentage={view.percentage}
          route={view.route}
          src={view.src}
          dst={view.dst}
          onDismiss={noop}
          onAccept={noop}
          onOpenRoute={noop}
        />
      )}
    </div>
  );
}
