import type { ComparisonSnapshot } from "@/comparison/types";
import { getTokenInfo } from "@/metadata/token-info/get-token-info";
import type { TokenInfo } from "@/metadata/token-info/token-index";
import { formatDisplayAmount } from "./format-display-amount";
import type { PillVariant } from "./Pill";

/**
 * Token end of a {@link OverlayView} — the side of a swap shown by one
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

/**
 * Map a {@link ComparisonSnapshot} (or its absence) onto an {@link OverlayView}.
 *
 * Pure function — given the same snapshot and metadata cache contents, it
 * always returns the same view. Lives outside React so the snapshot → state
 * contract is unit-testable without mounting components.
 *
 * Behaviour by `snapshot.status`:
 *
 * - `null` / `no_opinion` / `failed` → `null` (overlay renders nothing).
 *   Failures here are about the *quote-fetch* side; execution failure has
 *   its own card and isn't driven from this channel.
 * - `pending` → `scanning` pill.
 * - `ok` with `comparison.delta <= 0` → `all-good` pill (the dapp's
 *   quote is at parity or better).
 * - `ok` with `comparison.delta > 0` → `better-rate` card populated
 *   from `comparison` and `update.swap`. Token metadata is resolved
 *   synchronously via `getTokenInfo`; a `null` return propagates through
 *   and is rendered as "Unknown" by `TokenChip`.
 *
 * @remarks
 * Dismissal stickiness, debounce, exact copy, and the negative/uncertain
 * surface are intentionally not handled here — see MAR-32/33/35.
 */
export function snapshotToView(
  snapshot: ComparisonSnapshot | null,
): OverlayView | null {
  if (snapshot === null) return null;
  switch (snapshot.status) {
    case "pending":
      return { kind: "pill", variant: "scanning" };
    case "no_opinion":
    case "failed":
      return null;
    case "ok": {
      const { update, comparison } = snapshot;
      if (comparison.delta <= 0n) {
        return { kind: "pill", variant: "all-good" };
      }
      const { swap } = update;
      const srcToken = getTokenInfo(swap.chainIn, swap.tokenIn);
      const dstToken = getTokenInfo(swap.chainOut, swap.tokenOut);
      return {
        kind: "better-rate",
        percentage: comparison.percentage,
        route: comparison.routing ?? comparison.provider,
        src: {
          chainId: swap.chainIn,
          token: srcToken,
          amount: formatDisplayAmount(swap.amountIn, srcToken?.decimals),
        },
        dst: {
          chainId: swap.chainOut,
          token: dstToken,
          amount: formatDisplayAmount(swap.amountOut, dstToken?.decimals),
        },
      };
    }
  }
}
