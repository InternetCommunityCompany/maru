import type { TokenInfo } from "./tokens";

/** Props for the {@link TokenChip} component. */
export interface TokenChipProps {
  /** Token catalogue entry to render. */
  token: TokenInfo;
  /** Formatted human-readable amount, rendered above the symbol. */
  amount: string;
  /** Reverse the order so the icon sits on the right (use on destination). */
  reverse?: boolean;
  /** Highlight the amount in green to call out savings on the receive leg. */
  highlight?: boolean;
}

/**
 * Single-token row used inside the better-rate token strip. Composes an
 * icon disc with an amount + symbol stack.
 */
export function TokenChip({ token, amount, reverse, highlight }: TokenChipProps) {
  const icon = (
    <div className="ol-token-icon" style={{ background: token.color }}>
      {token.icon}
    </div>
  );
  const info = (
    <div className={"ol-token-info" + (reverse ? " right" : "")}>
      <div className={"ol-token-amount" + (highlight ? " hl" : "")}>{amount}</div>
      <div className="ol-token-symbol">{token.sym}</div>
    </div>
  );
  return (
    <div className={"ol-token" + (reverse ? " reverse" : "")}>
      {reverse ? (
        <>
          {info}
          {icon}
        </>
      ) : (
        <>
          {icon}
          {info}
        </>
      )}
    </div>
  );
}
