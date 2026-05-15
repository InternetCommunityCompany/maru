import type { TokenMeta, TokenMetaResolver } from "./types";

// Native-coin pseudo-addresses commonly used across aggregator APIs.
const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const ZERO = "0x0000000000000000000000000000000000000000";

// Minimal seed of decimals + symbols for the V1 target tokens.
//
// This is a temporary stand-in for the MAR-82 token-info module
// (`getTokenInfoCached`). When MAR-82 lands, swap `resolveTokenMeta` for
// that accessor and delete this file — the grounding module itself only
// depends on the `TokenMetaResolver` shape.
const SEED: ReadonlyMap<string, TokenMeta> = new Map([
  // Ethereum mainnet
  [`1:${NATIVE}`, { decimals: 18, symbol: "ETH" }],
  [`1:${ZERO}`, { decimals: 18, symbol: "ETH" }],
  [
    "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    { decimals: 6, symbol: "USDC" },
  ],
  [
    "1:0xdac17f958d2ee523a2206206994597c13d831ec7",
    { decimals: 6, symbol: "USDT" },
  ],
  [
    "1:0x6b175474e89094c44da98b954eedeac495271d0f",
    { decimals: 18, symbol: "DAI" },
  ],
  [
    "1:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    { decimals: 18, symbol: "WETH" },
  ],
  [
    "1:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    { decimals: 8, symbol: "WBTC" },
  ],
  // Polygon
  [`137:${NATIVE}`, { decimals: 18, symbol: "MATIC" }],
  [
    "137:0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    { decimals: 6, symbol: "USDC" },
  ],
  // BNB Chain
  [`56:${NATIVE}`, { decimals: 18, symbol: "BNB" }],
  [
    "56:0x55d398326f99059ff775485246999027b3197955",
    { decimals: 18, symbol: "USDT" },
  ],
  // Arbitrum
  [`42161:${NATIVE}`, { decimals: 18, symbol: "ETH" }],
  [
    "42161:0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    { decimals: 6, symbol: "USDC" },
  ],
  // Optimism
  [`10:${NATIVE}`, { decimals: 18, symbol: "ETH" }],
  [
    "10:0x0b2c639c533813f4aa9d7837caf62653d097ff85",
    { decimals: 6, symbol: "USDC" },
  ],
  // Base
  [`8453:${NATIVE}`, { decimals: 18, symbol: "ETH" }],
  [
    "8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    { decimals: 6, symbol: "USDC" },
  ],
]);

/**
 * V1 stub for `TokenMetaResolver`.
 *
 * Returns metadata for the most-used tokens on the [MAR-15] target dapp
 * list, lower-casing the address before lookup. Returns `null` for unknown
 * tokens — the grounding matcher skips those candidates, and the arbiter
 * falls through to its no-grounding tier.
 *
 * @remarks
 * Wire-compatible with the eventual `getTokenInfoCached(chainId, address)`
 * from [MAR-82]; the call site in `injected.content.ts` is the only thing
 * that needs to change when that module lands.
 */
export const resolveTokenMeta: TokenMetaResolver = (chainId, address) => {
  return SEED.get(`${chainId}:${address.toLowerCase()}`) ?? null;
};
