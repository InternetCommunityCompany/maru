import { lookupChain } from "@/metadata/chain-info/chain-index";
import { lookupToken } from "./token-index";
import type { TokenInfo } from "./token-index";

/**
 * Canonical address used everywhere to mean "the chain's native gas token".
 * Producers upstream (`normalize-token-address`) rewrite all known native
 * sentinels (`0xeeee…`, the string `"ETH"`, etc.) to this value before any
 * consumer sees them, so this is the only literal we check.
 */
const CANONICAL_NATIVE = "0x0000000000000000000000000000000000000000";

/**
 * Synchronous lookup of token metadata for `(chainId, address)`.
 *
 * For ERC-20 addresses, reads the tokenlist-backed index. For the canonical
 * native address, synthesises a `TokenInfo` from the chain's `nativeCurrency`
 * + `iconUrl` — Uniswap's tokenlist doesn't carry native entries, so without
 * this fall-through the overlay renders "Unknown" on ETH/MATIC/etc. swaps.
 *
 * Returns `null` when neither the token nor the chain is in the index. Case-
 * insensitive on `address`.
 */
export function getTokenInfo(chainId: number, address: string): TokenInfo | null {
  const direct = lookupToken(chainId, address);
  if (direct) return direct;
  if (address.toLowerCase() !== CANONICAL_NATIVE) return null;
  const chain = lookupChain(chainId);
  if (!chain?.nativeCurrency) return null;
  return {
    chainId,
    address: CANONICAL_NATIVE,
    decimals: chain.nativeCurrency.decimals,
    symbol: chain.nativeCurrency.symbol,
    name: chain.nativeCurrency.name,
    logoURI: chain.iconUrl ?? undefined,
  };
}
