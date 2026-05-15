import type { ComparisonSnapshot } from "@/comparison/types";

type Listener = () => void;

/**
 * Minimal external store for the current `ComparisonSnapshot`.
 *
 * Lives at module scope so that the `provideComparisonChannel` subscription —
 * which is wired once at content-script boot, outside React — can push
 * snapshots into a place the `Overlay` component reads via
 * `useSyncExternalStore`. Holds only the latest snapshot; subscribers re-read
 * the current value on each change notification.
 *
 * The store is intentionally untyped beyond `ComparisonSnapshot | null` —
 * mapping to an `OverlayView` happens at read time inside the component so
 * the snapshot stays the source of truth for tests and dev tools.
 */
export function createSnapshotStore() {
  let current: ComparisonSnapshot | null = null;
  const listeners = new Set<Listener>();

  return {
    /** Read the current snapshot. */
    get(): ComparisonSnapshot | null {
      return current;
    },
    /** Replace the current snapshot and notify subscribers. */
    set(next: ComparisonSnapshot | null): void {
      current = next;
      for (const listener of listeners) listener();
    },
    /** Subscribe to change notifications. Returns an unsubscribe function. */
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type SnapshotStore = ReturnType<typeof createSnapshotStore>;
