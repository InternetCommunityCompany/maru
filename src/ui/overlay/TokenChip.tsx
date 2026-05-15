import { getChainInfo } from "@/metadata/chain-info/get-chain-info";
import type { TokenInfo } from "@/metadata/token-info/types";
import { cx } from "@/ui/cx";

/** Truncated form for an unknown address — `0x1234…cdef`. */
function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Props for the {@link TokenChip} component. */
export interface TokenChipProps {
  /** Token metadata. `null` when `getTokenInfo` had no entry — renders as "Unknown" + placeholder. */
  token: TokenInfo | null;
  /** Fallback address used when `token` is `null` to label the chip. */
  address?: string;
  /** Formatted human-readable amount, rendered above the symbol. */
  amount: string;
  /**
   * EVM chain id of the token. When provided, the chip renders a small
   * chain badge layered on the icon disc, sourced from `getChainInfo`. The
   * badge is silently omitted when `getChainInfo` returns `null` or carries
   * no `iconUrl` — there's no broken-image placeholder.
   */
  chainId?: number;
  /** Reverse the order so the icon sits on the right (use on destination). */
  reverse?: boolean;
  /** Highlight the amount in green to call out savings on the receive leg. */
  highlight?: boolean;
}

/**
 * Single-token row used inside the better-rate token strip. Composes an
 * icon disc with an amount + symbol stack, plus an optional cross-chain
 * badge on the icon disc when `chainId` is supplied.
 */
export function TokenChip({
  token,
  address,
  amount,
  chainId,
  reverse,
  highlight,
}: TokenChipProps) {
  const symbol = token?.symbol ?? "Unknown";
  const name = token?.name ?? (address ? truncateAddress(address) : null);
  const logo = token?.logoURI ?? null;
  const chain = chainId != null ? getChainInfo(chainId) : null;
  const chainIcon = chain?.iconUrl ?? null;
  const chainLabel = chain?.shortName ?? chain?.name ?? null;

  const icon = (
    <div className="ol-token-icon">
      {logo ? (
        <img
          className="ol-token-logo"
          src={logo}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="ol-token-logo placeholder" aria-hidden="true" />
      )}
      {chainIcon != null && (
        <img
          className="ol-token-chain-badge"
          src={chainIcon}
          alt={chainLabel ?? ""}
          title={chainLabel ?? undefined}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
  const info = (
    <div className={cx("ol-token-info", reverse && "right")}>
      <div className={cx("ol-token-amount", highlight && "hl")}>{amount}</div>
      <div className="ol-token-symbol" title={name ?? undefined}>
        {symbol}
      </div>
    </div>
  );
  return (
    <div className={cx("ol-token", reverse && "reverse")}>
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
