/**
 * One chain's metadata as exposed via {@link getChainInfo} and as it appears
 * on the wire from `GET /api/chainlist`. `iconUrl` is the resolved URL the
 * backend ships; `null` when upstream had no icon. `nativeCurrency` lets
 * {@link getTokenInfo} synthesise a `TokenInfo` for the chain's native gas
 * token (Uniswap's tokenlist is ERC-20–only).
 */
export type ChainInfo = {
  chainId: number;
  name: string;
  shortName: string;
  iconUrl: string | null;
  nativeCurrency: NativeCurrency | null;
};

/** The chain's native gas token (ETH on mainnet, MATIC on Polygon, …). */
export type NativeCurrency = {
  name: string;
  symbol: string;
  decimals: number;
};

/** Backend response shape for `/api/chainlist`. */
export type ChainList = {
  chains: ChainInfo[];
};

/** `data` is the raw backend payload; `fetchedAt` drives the TTL check. */
export type StoredChainList = {
  data: ChainList;
  fetchedAt: number;
};
