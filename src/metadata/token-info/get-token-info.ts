import { lookupToken } from "./token-index";
import type { TokenInfo } from "./token-index";

/**
 * Synchronous lookup of token metadata for `(chainId, address)`.
 *
 * Returns `null` for unknown tokens — that's the expected, normal outcome
 * for any address not on a curated list. Callers handle the null path:
 * UI surfaces render "Unknown" + the truncated address with a placeholder
 * logo; the DOM-grounding formatter skips the candidate and the arbiter
 * falls through to its no-grounding tier.
 *
 * @remarks
 * Address comparison is case-insensitive. The function is safe to call
 * before the index has been hydrated — it just returns `null` until the
 * background SW finishes reading the persisted blob (`ensureTokenList`
 * runs at SW boot before any consumer can be triggered, so this window is
 * a single tick).
 */
export function getTokenInfo(chainId: number, address: string): TokenInfo | null {
  return lookupToken(chainId, address);
}
