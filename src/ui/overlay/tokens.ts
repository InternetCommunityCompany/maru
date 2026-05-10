/**
 * Token catalogue keyed by symbol. Used by overlay components to render the
 * source / destination chips on the better-rate and success cards.
 *
 * @remarks
 * `color` is the brand colour for the icon disc; `icon` is a single-character
 * glyph rendered inside it (we don't ship per-token logos).
 */
export interface TokenInfo {
  sym: string;
  color: string;
  icon: string;
}

/** Static demo token catalogue. */
export const TOKEN_CATALOGUE: Record<string, TokenInfo> = {
  USDC: { sym: "USDC", color: "#2775ca", icon: "$" },
  ETH: { sym: "ETH", color: "#627eea", icon: "◆" },
  ACX: { sym: "ACX", color: "#43e3b1", icon: "✕" },
  ARB: { sym: "ARB", color: "#28a0f0", icon: "▲" },
  DAI: { sym: "DAI", color: "#f5ac37", icon: "◈" },
};
