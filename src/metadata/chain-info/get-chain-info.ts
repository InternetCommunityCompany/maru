import { lookupChain } from "./chain-index";
import type { ChainInfo } from "./types";

/**
 * Synchronous lookup of chain metadata for `chainId`.
 *
 * Returns `null` for unknown chains — that's the expected, normal outcome for
 * any chainId not covered by the cached list (e.g. a chain launched after the
 * last refresh). Callers handle the null path: the alert overlay omits the
 * chain badge entirely; other surfaces fall back to rendering the bare
 * chainId.
 *
 * @remarks
 * The function is safe to call before the index has been hydrated — it just
 * returns `null` until the background SW finishes reading the persisted blob
 * (`ensureChainList` runs at SW boot before any consumer can be triggered, so
 * this window is a single tick).
 */
export function getChainInfo(chainId: number): ChainInfo | null {
  return lookupChain(chainId);
}
