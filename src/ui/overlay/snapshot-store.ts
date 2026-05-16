import type { ComparisonSnapshot } from "@/comparison/types";

type Listener = () => void;

/**
 * `useSyncExternalStore`-compatible holder for the current snapshot. Mounted
 * at module scope so the `onComparison` port handler — wired once outside
 * React — can push into it.
 */
export function createSnapshotStore() {
  let current: ComparisonSnapshot | null = null;
  const listeners = new Set<Listener>();

  return {
    get(): ComparisonSnapshot | null {
      return current;
    },
    set(next: ComparisonSnapshot | null): void {
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type SnapshotStore = ReturnType<typeof createSnapshotStore>;
