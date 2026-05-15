import type { TokenInfo } from "@/metadata/token-info/types";
import type { PillVariant } from "./Pill";

/**
 * Whether a swap is single-chain or cross-chain. Determines the step labels
 * and step-row count on the execution-side cards.
 *
 * @remarks
 * Kept on `ExecutingCard` / `SuccessCard` where bridge vs. swap genuinely
 * changes step labels (e.g. "Sign / Confirm" vs. "Source / Bridging"). The
 * snapshot-driven alert card (`BetterRateCard`) no longer branches on this
 * — cross-chain there is derived from `srcChainId !== dstChainId` and only
 * feeds chain-icon rendering on `TokenChip`.
 */
export type SwapMode = "swap" | "bridge";

/**
 * Token end of a {@link BetterRateView} — the side of a swap shown by one
 * `TokenChip` on the better-rate card.
 *
 * `token` is `null` when `getTokenInfo` had no entry for `(chainId, address)`
 * — the card renders "Unknown" + placeholder logo, per MAR-82's UI fallback.
 * `amount` is already formatted for display (see `formatDisplayAmount`).
 */
export type TokenSide = {
  chainId: number;
  /** Token metadata, or `null` when the lookup missed. */
  token: TokenInfo | null;
  /** Human-formatted amount, derived from the snapshot's raw uint256. */
  amount: string;
};

/**
 * Discriminated view descriptor the overlay renders.
 *
 * Produced by `snapshotToView`. The overlay reads one of these from its
 * subscription store and dispatches on `kind` — either a compact pill or
 * the full better-rate card. The `dismissed` / `hidden` state is encoded
 * by storing `null` instead of an `OverlayView` (no card mounted).
 *
 * Execution-side cards (`executing`, `success`, `failed`) are not
 * reachable from the snapshot mapper; their components survive in the
 * codebase but live behind a future wiring owned by the execution project.
 */
export type OverlayView =
  | { kind: "pill"; variant: PillVariant }
  | {
      kind: "better-rate";
      /** Relative delta, percent. `null` when the dapp's `amountOut` was zero. */
      percentage: number | null;
      /** Provider/route label shown on the headline (`comparison.routing ?? provider`). */
      route: string;
      src: TokenSide;
      dst: TokenSide;
    };
