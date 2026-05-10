const ALIASES: Record<string, number> = {
  // Ethereum mainnet
  ethereum: 1,
  eth: 1,
  mainnet: 1,
  // BNB Smart Chain
  bsc: 56,
  binance: 56,
  bnb: 56,
  // Polygon
  polygon: 137,
  pol: 137,
  matic: 137,
  // Optimism
  optimism: 10,
  opt: 10,
  // Arbitrum One
  arbitrum: 42161,
  arb: 42161,
  arbitrum_one: 42161,
  "arbitrum-one": 42161,
  // Avalanche C-Chain
  avalanche: 43114,
  avax: 43114,
  ava: 43114,
  // Fantom
  fantom: 250,
  ftm: 250,
  // Gnosis (formerly xDai)
  gnosis: 100,
  dai: 100,
  xdai: 100,
  // Base
  base: 8453,
  // Aurora
  aurora: 1313161554,
  aur: 1313161554,
  // zkSync Era
  zksync: 324,
  "zksync-era": 324,
  // Polygon zkEVM
  "polygon-zkevm": 1101,
  polygonzkevm: 1101,
  // Linea
  linea: 59144,
  // Celo
  celo: 42220,
  cel: 42220,
  // Moonbeam / Moonriver
  moonbeam: 1284,
  moo: 1284,
  moonriver: 1285,
  mor: 1285,
  // Klaytn
  klaytn: 8217,
  // BitTorrent Chain
  bttc: 199,
  // Cronos
  cronos: 25,
  cro: 25,
  // Velas
  velas: 106,
  vel: 106,
  // Fuse
  fuse: 122,
  fus: 122,
  // Mantle
  mantle: 5000,
  // Scroll
  scroll: 534352,
  // Blast
  blast: 81457,
  // Berachain
  berachain: 80094,
  // Sonic
  sonic: 146,
  // X Layer
  xlayer: 196,
  // Ink (Kraken)
  ink: 57073,
};

/**
 * Coerces a chain identifier to its EVM numeric chain id.
 *
 * Recognises common string aliases used across dapp/aggregator APIs
 * (`"ethereum"`/`"eth"`, `"arbitrum"`/`"arb"`, `"polygon"`/`"pol"`/`"matic"`,
 * etc.) case-insensitively. Numeric inputs (or digit strings) pass through
 * via `parseInt`; bigints are narrowed via `Number`. Returns `null` on
 * anything unrecognised.
 *
 * Used to bridge the gap between URL-keyed APIs that put a chain name in
 * the path (KyberSwap, LI.FI's `fromChain=eth`) and the schema's
 * `chainIn`/`chainOut` numeric fields.
 */
export const coerceChainId = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    const aliased = ALIASES[value.toLowerCase()];
    if (aliased !== undefined) return aliased;
  }
  if (typeof value === "bigint") return Number(value);
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
