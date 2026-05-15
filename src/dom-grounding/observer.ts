import type { TextNodeSnapshot } from "./types";
import { walkText } from "./walk-text";

const DEFAULT_DEBOUNCE_MS = 200;

/**
 * Handle returned by {@link createDomObserver}. Lets the wiring layer ask
 * for the current snapshot and stop the observer at session-lock time.
 */
export type ObserverHandle = {
  /**
   * Most recent text snapshot. Cheap — already computed. Stays stable
   * between flushes (no re-walk on read).
   */
  snapshot: () => TextNodeSnapshot[];
  /**
   * Force a re-walk and return the new snapshot. Used by the wiring layer
   * to refresh before a synchronous matcher call when the observer might
   * not have flushed yet.
   */
  refresh: () => TextNodeSnapshot[];
  /**
   * Tear down the observer, clear timers, and unhook visibility/listeners.
   * Idempotent — repeated calls are no-ops.
   *
   * The arbiter calls this when a session locks (a final emission has been
   * made and no further refinement is expected). Bounds steady-state CPU on
   * any tab where a quote is sitting in a finalised state.
   */
  detach: () => void;
};

export type ObserverOptions = {
  /** Root to walk and observe. Defaults to `document.body`. */
  root?: Element | Document;
  /** Debounce window for re-walks after a mutation (ms). */
  debounceMs?: number;
  /** Optional walker override — injected for tests. */
  walk?: (root: Node) => TextNodeSnapshot[];
};

const resolveRoot = (
  override: Element | Document | undefined,
): Node | null => {
  if (override) return override;
  if (typeof document === "undefined") return null;
  return document.body ?? document;
};

/**
 * Wrap a `MutationObserver` around the rendered DOM and maintain a
 * debounced text snapshot the synchronous grounding matcher can read on
 * every arbiter emission.
 *
 * @remarks
 * Observes broadly (`subtree: true`, `characterData: true`,
 * `childList: true`) because the matcher itself scopes by ancestor
 * labels — per-site selectors aren't needed for V1.
 *
 * Auto-suspends on `visibilitychange` so a hidden tab stops walking. The
 * snapshot is refreshed on the next visibility-on tick.
 *
 * Returns `null` only when called in an environment with no `document`
 * (e.g. unit tests under a Node environment that didn't load happy-dom).
 * Callers must check.
 */
export function createDomObserver(
  options: ObserverOptions = {},
): ObserverHandle | null {
  const root = resolveRoot(options.root);
  if (!root) return null;
  if (typeof MutationObserver === "undefined") return null;

  const walk = options.walk ?? walkText;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  let snapshot: TextNodeSnapshot[] = walk(root);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = true;
  let detached = false;

  const flush = (): void => {
    timer = null;
    if (!active || detached) return;
    snapshot = walk(root);
  };

  const schedule = (): void => {
    if (detached || !active) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const observer = new MutationObserver(() => schedule());
  observer.observe(root, {
    subtree: true,
    characterData: true,
    childList: true,
  });

  const onVisibility = (): void => {
    if (typeof document === "undefined") return;
    if (document.hidden) {
      active = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    } else {
      active = true;
      // Immediate refresh so the next matcher call sees what the user sees
      // on tab-switch-back without waiting a debounce.
      snapshot = walk(root);
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  return {
    snapshot: () => snapshot,
    refresh: () => {
      if (detached) return snapshot;
      snapshot = walk(root);
      return snapshot;
    },
    detach: () => {
      if (detached) return;
      detached = true;
      active = false;
      observer.disconnect();
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    },
  };
}
