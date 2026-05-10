/**
 * Overlay state machine.
 *
 * @remarks
 * - `scanning`   — pill: "checking N sources…"
 * - `all-good`   — pill: "you've got the best rate"
 * - `working`    — pill: "working… don't refresh" (executing collapsed)
 * - `better`     — full card: a better swap rate is available
 * - `bridge`     — full card: a better cross-chain rate is available
 * - `executing`  — full card with progress steps
 * - `success`    — full card celebrating realised savings
 * - `failed`     — full card with retry / cancel
 * - `dismissed`  — overlay hidden until the next page load
 */
export type OverlayState =
  | "scanning"
  | "all-good"
  | "working"
  | "better"
  | "bridge"
  | "executing"
  | "success"
  | "failed"
  | "dismissed";

/**
 * Whether a swap is single-chain or cross-chain. Determines the route name,
 * step labels, and headline copy on the better-rate card.
 */
export type SwapMode = "swap" | "bridge";
