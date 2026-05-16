import type { DebugEvent } from "./debug-event";

/**
 * Producer/consumer pair on a single MAIN-world `EventTarget` singleton. In
 * production `bus` is `null` so both functions short-circuit on entry; Vite's
 * DCE collapses the bodies because `import.meta.env.DEV` is statically
 * replaced at build time.
 */
const bus: EventTarget | null = import.meta.env.DEV ? new EventTarget() : null;

/**
 * Fire-and-forget producer hook. Tree-shakes to a no-op in production via the
 * `bus === null` early return; call sites stay clean of build-mode checks.
 */
export const recordTrace = (event: DebugEvent): void => {
  if (bus === null) return;
  bus.dispatchEvent(new CustomEvent("trace", { detail: event }));
};

/**
 * Same-world subscription, used only by the dev-only debug relay that mirrors
 * MAIN-world traces to the background ring buffer. No-op in production.
 */
export const onTrace = (listener: (event: DebugEvent) => void): void => {
  if (bus === null) return;
  bus.addEventListener("trace", (e) =>
    listener((e as CustomEvent<DebugEvent>).detail),
  );
};
