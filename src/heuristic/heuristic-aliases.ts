/**
 * Field-name aliases the heuristic matcher tries against parsed JSON bodies.
 *
 * Each entry is a list of dot paths, in priority order. The matcher walks
 * the list against both the request and response body and returns the first
 * value that passes the field's validator (address regex, digit-string,
 * positive integer). Aliases are case-sensitive; APIs that mix casings
 * within their own bodies are vanishingly rare and case-insensitive
 * matching is the main source of false positives.
 *
 * Drawn from cross-referencing 1inch, 0x, OKX DEX, Lifi, KyberSwap,
 * Paraswap, and OpenOcean traffic — extend the lists as new shapes show
 * up.
 */
export const HEURISTIC_ALIASES = {
  tokenIn: [
    "fromTokenAddress",
    "tokenIn",
    "sellToken",
    "srcToken",
    "inputToken",
    "fromToken.address",
    "tokenInAddress",
    "sellTokenAddress",
  ],
  tokenOut: [
    "toTokenAddress",
    "tokenOut",
    "buyToken",
    "dstToken",
    "outputToken",
    "toToken.address",
    "tokenOutAddress",
    "buyTokenAddress",
  ],
  amountIn: [
    "fromAmount",
    "amountIn",
    "sellAmount",
    "srcAmount",
    "inputAmount",
    "amount",
  ],
  amountOut: [
    "toAmount",
    "amountOut",
    "buyAmount",
    "dstAmount",
    "outputAmount",
    "outAmount",
  ],
  chainIn: ["fromChainId", "srcChainId", "inChainId", "chainId"],
  chainOut: ["toChainId", "dstChainId", "outChainId", "chainId"],
  fromAddress: ["fromAddress", "from", "userAddress", "wallet", "user"],
} as const satisfies Record<string, readonly string[]>;
