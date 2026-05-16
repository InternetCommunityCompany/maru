import type { SwapEvent } from "@/template-engine/build-swap-event";
import type { SessionKey, SessionPartialKey } from "./types";

const normAmount = (v: string): string => {
  // Normalise via BigInt so `"1000"`, `"1000.0"`, `"+1000"`, and `"0x3e8"`
  // collapse onto one session. SwapEvent amounts are spec'd as integer
  // strings; the decimal trim is defensive for upstream engines that haven't
  // been audited.
  const trimmed = v.includes(".") ? v.slice(0, v.indexOf(".")) : v;
  try {
    return BigInt(trimmed).toString();
  } catch {
    return v;
  }
};

/**
 * Derives a stable session key from a `SwapEvent`.
 *
 * The key includes `amountIn` so different input amounts on the same trade
 * pair are separate sessions (and the prior one is evicted via
 * `partialSessionKey`). Domain and token addresses are lower-cased so casing
 * differences across engines (template vs heuristic) don't shard the same
 * trade across two sessions.
 */
export function sessionKey(swap: SwapEvent): SessionKey {
  return [
    "k",
    swap.domain.toLowerCase(),
    swap.chainIn,
    swap.chainOut,
    swap.tokenIn.toLowerCase(),
    swap.tokenOut.toLowerCase(),
    normAmount(swap.amountIn),
  ].join("|");
}

/**
 * Eviction-only key — `sessionKey` with `amountIn` dropped.
 *
 * `SessionStore` looks sessions up by this key when a new amount opens a
 * fresh session, so the prior session for the same trade pair on the same
 * domain can be closed before it leaks past its idle TTL.
 */
export function partialSessionKey(swap: SwapEvent): SessionPartialKey {
  return [
    "p",
    swap.domain.toLowerCase(),
    swap.chainIn,
    swap.chainOut,
    swap.tokenIn.toLowerCase(),
    swap.tokenOut.toLowerCase(),
  ].join("|");
}
