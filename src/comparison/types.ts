import type { QuoteUpdate } from "@/arbiter/types";

export type QuoteRequestKind = "exact_in" | "exact_out";

/**
 * Body of `POST /api/quotes`. Mirrors the Zod schema in `maru-backend`.
 * Privacy model: the extension sends only trade params, never the dapp's
 * observed quote.
 */
export type QuoteRequest = {
  chainIn: number;
  chainOut: number;
  /** Lowercased hex address, or the zero-address sentinel for native tokens. */
  tokenIn: string;
  tokenOut: string;
  /** Raw uint256 string. `tokenIn` units for `exact_in`, `tokenOut` for `exact_out`. */
  amount: string;
  kind: QuoteRequestKind;
  /** Wallet signing the swap; optional, only used by sources that require it. */
  taker?: string;
};

/** Body of `200 OK` from `/api/quotes`. Mirrors `maru-backend/src/types.ts`. */
export type BestQuote = {
  provider: string;
  /** Improved destination amount (exact-in) or required input (exact-out). Raw uint256. */
  amountOut: string;
  routing?: string;
  /** `units` is native-token wei equivalents; `usd` is filled when the source pre-computes it. */
  gas?: { units: string; usd?: number };
  fetchedAt: number;
  /** Opaque pass-through; the future executor needs it verbatim (Uniswap echoes the whole quote). */
  raw: unknown;
};

/**
 * `delta` is `backend.amountOut - dapp.amountOut` in `tokenOut` base units —
 * positive means the backend is better. Carried as a signed decimal string so
 * the snapshot stays JSON-serializable across `runtime.Port.postMessage`
 * (BigInt would throw at the wire); consumers wrap with `BigInt(...)` before
 * arithmetic. `percentage` is `null` when the dapp amount is zero.
 *
 * Gas accounting is intentionally absent — V1 compares gross `amountOut`.
 */
export type ComparisonResult = {
  delta: string;
  percentage: number | null;
  provider: string;
  routing?: string;
};

/**
 * Wire payload on the comparison channel. Status names match the
 * orchestrator's cache entries so the transform is a one-step pass-through
 * (`ok` carries a derived `comparison`; the rest just add `update`).
 */
export type ComparisonSnapshot =
  | { status: "pending"; update: QuoteUpdate }
  | { status: "ok"; update: QuoteUpdate; comparison: ComparisonResult }
  | { status: "no_opinion"; update: QuoteUpdate }
  | { status: "failed"; update: QuoteUpdate };
