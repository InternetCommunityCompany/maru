import type { ComparisonSnapshot } from "@/comparison/types";
import { getTokenInfo } from "@/metadata/token-info/get-token-info";
import { formatDisplayAmount } from "./format-display-amount";
import type { OverlayView } from "./types";

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
 * - `result` with `comparison.delta <= 0` → `all-good` pill (the dapp's
 *   quote is at parity or better).
 * - `result` with `comparison.delta > 0` → `better-rate` card populated
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
    case "result": {
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
