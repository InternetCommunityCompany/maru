import type { SwapEvent } from "@/template-engine/build-swap-event";
import type { BestQuote, ComparisonResult } from "./types";

/**
 * Pure: derive a `ComparisonResult` from the dapp's `SwapEvent` and the
 * backend's `BestQuote`.
 *
 * Both `amountOut` values are interpreted as raw `tokenOut` base units;
 * decimal handling is the consumer's job. No gas accounting in V1 — see the
 * note on `ComparisonResult` (MAR-91 covers gas).
 *
 * Returns `percentage: null` when `dapp.amountOut` is zero or unparseable —
 * we can't compute a meaningful relative delta against a zero denominator.
 * The `delta` is still well-defined in that case.
 */
export function compareQuotes(
  dapp: SwapEvent,
  backend: BestQuote,
): ComparisonResult {
  const dappAmount = parseBigInt(dapp.amountOut);
  const backendAmount = parseBigInt(backend.amountOut);
  const delta = backendAmount - dappAmount;
  const percentage =
    dappAmount === 0n ? null : Number((delta * 10000n) / dappAmount) / 100;
  return {
    delta: delta.toString(),
    percentage,
    provider: backend.provider,
    ...(backend.routing !== undefined ? { routing: backend.routing } : {}),
  };
}

const parseBigInt = (v: string): bigint => {
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
};
