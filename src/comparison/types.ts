import type { QuoteUpdate } from "@/arbiter/types";

/**
 * Which side of the trade is fixed.
 *
 * Mirrors the backend's `QuoteRequest.kind`. `exact_in` is the only value the
 * arbiter currently produces — `SwapEvent.amountIn` is treated as fixed and
 * `amountOut` is what we compare against the backend's better quote.
 */
export type QuoteRequestKind = "exact_in" | "exact_out";

/**
 * Body of `POST /api/quotes`.
 *
 * Mirrors the Zod schema in `maru-backend/src/types.ts`. Keep this in sync
 * with the backend — the privacy model relies on the extension sending only
 * trade params, never the dapp's observed quote.
 */
export type QuoteRequest = {
  /** EVM chain id of the source token. */
  chainIn: number;
  /** EVM chain id of the destination token. Equal to `chainIn` for same-chain swaps. */
  chainOut: number;
  /** Source token. Lowercased hex address, or the zero address sentinel for the chain's native token. */
  tokenIn: string;
  /** Destination token. Same convention as `tokenIn`. */
  tokenOut: string;
  /** Trade amount, raw uint256 string. `tokenIn` units for `exact_in`, `tokenOut` units for `exact_out`. */
  amount: string;
  /** Which side of the trade is fixed. */
  kind: QuoteRequestKind;
  /** Wallet address signing the eventual swap. Optional. */
  taker?: string;
};

/**
 * Body of `200 OK` responses from `POST /api/quotes`.
 *
 * Mirrors `maru-backend/src/types.ts`. A `204` is sent when no source had an
 * opinion — surfaced upstream as a `no_opinion` `ComparisonSnapshot`.
 *
 * @remarks
 * `raw` is intentionally typed as `unknown` — it's an opaque pass-through bag
 * the future executor needs verbatim (Uniswap requires the entire quote object
 * echoed back). This extension never inspects it.
 */
export type BestQuote = {
  /** Name of the source that produced the winning quote (`"uniswap"`, …). */
  provider: string;
  /** Improved destination amount (exact-in) or required input (exact-out). Raw uint256 string. */
  amountOut: string;
  /** Human-readable route description for UI display. */
  routing?: string;
  /**
   * Gas estimate for the entire swap. `units` is in native-token wei
   * equivalents; `usd` is filled when the source pre-computes it.
   */
  gas?: {
    units: string;
    usd?: number;
  };
  /** Epoch ms the quote was fetched at. */
  fetchedAt: number;
  /** Pass-through bag from the upstream source. Opaque to the extension. */
  raw: unknown;
};

/**
 * Quantitative comparison between the dapp's quote and the backend's best.
 *
 * `delta` is computed in `tokenOut` base units — positive means the backend
 * is better for `exact_in` (more `tokenOut` for the same `tokenIn`), zero
 * means parity, negative means the dapp is better. As a `bigint` because
 * `amountOut` is a uint256 string that can overflow `number`.
 *
 * `percentage` is a finite `number` in the open interval `(-Infinity, +Infinity)`
 * — `delta / dappAmountOut * 100`, rounded by JS float math. Callers that
 * need precise display formatting should re-derive from `delta` and the
 * decimals of `tokenOut`. `null` when `dappAmountOut` is zero (no meaningful
 * relative comparison).
 *
 * @remarks
 * Gas accounting is intentionally absent — V1 compares gross `amountOut`.
 * MAR-91 will fold gas back in once we have a unified USD-pricing path.
 */
export type ComparisonResult = {
  /** `backend.amountOut - dapp.amountOut`, in `tokenOut` base units. */
  delta: bigint;
  /** Relative delta as `delta / dapp.amountOut * 100`. `null` when the dapp amount is zero. */
  percentage: number | null;
  /** Forwarded from `BestQuote.provider`. */
  provider: string;
  /** Forwarded from `BestQuote.routing`, if present. */
  routing?: string;
};

/**
 * Wire payload on `ComparisonChannel`. Discriminated union by `status` —
 * each variant describes the orchestrator's state for the current session,
 * not what any consumer should do with it.
 *
 * The `update` carried is the current best `QuoteUpdate` for the session at
 * snapshot time. Subscribers can compare across snapshots by `update.sessionKey`
 * and `update.sequence` to dedupe.
 */
export type ComparisonSnapshot =
  | {
      status: "pending";
      /** Current best `QuoteUpdate` for the session. */
      update: QuoteUpdate;
    }
  | {
      status: "result";
      update: QuoteUpdate;
      /** Computed against `update.swap.amountOut`. `delta` may be positive, zero, or negative. */
      comparison: ComparisonResult;
    }
  | {
      status: "no_opinion";
      update: QuoteUpdate;
    }
  | {
      status: "failed";
      update: QuoteUpdate;
    };
