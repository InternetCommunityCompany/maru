const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const CANONICAL_NATIVE = "0x0000000000000000000000000000000000000000";

const NATIVE_SENTINELS = new Set<string>([
  // 1inch / OKX-style sentinel for native gas tokens.
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  // Symbolic native markers some APIs use in lieu of an address.
  "native",
  "eth",
  "bnb",
  "matic",
  "pol",
  "avax",
  "ftm",
  "celo",
  "xdai",
]);

/**
 * Coerces a token-shaped value to a canonical address string.
 *
 * - Plain ERC-20 / contract addresses (`^0x[a-fA-F0-9]{40}$`) pass through
 *   with their original casing preserved (so checksummed inputs stay
 *   checksummed).
 * - Known native-asset sentinels — `0xEeee…eEEeE` (1inch-style) and string
 *   literals like `"NATIVE"`, `"ETH"`, `"BNB"`, `"MATIC"` (case-insensitive)
 *   — are rewritten to `0x0000000000000000000000000000000000000000` so that
 *   "this is the chain's native token" is one shape across dapps.
 * - Anything else returns `null` (the field is unresolvable).
 */
export const normalizeTokenAddress = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (NATIVE_SENTINELS.has(value.toLowerCase())) return CANONICAL_NATIVE;
  if (ADDRESS_RE.test(value)) return value;
  return null;
};
