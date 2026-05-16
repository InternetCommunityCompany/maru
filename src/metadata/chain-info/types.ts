/**
 * One chain's metadata as exposed via {@link getChainInfo} and as it appears
 * on the wire from `GET /api/chainlist`. `iconUrl` is the resolved URL the
 * backend ships; `null` when upstream had no icon.
 */
export type ChainInfo = {
  chainId: number;
  name: string;
  shortName: string;
  iconUrl: string | null;
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
