import type { QuoteUpdate } from "@/arbiter/types";
import type { AlertTokenView, AlertViewModel } from "./types";

const ADDRESS_RE = /^0x[a-f0-9]{40}$/i;

export function toAlertView(update: QuoteUpdate): AlertViewModel {
  const { swap } = update;
  const mode = swap.type === "bridge" || swap.chainIn !== swap.chainOut ? "bridge" : "swap";
  const route = formatRoute(swap.provider ?? swap.templateId);

  return {
    state: mode === "bridge" ? "bridge" : "better",
    card: {
      sessionKey: update.sessionKey,
      sequence: update.sequence,
      candidateId: update.candidateId,
      mode,
      route,
      source: {
        token: tokenView(swap.tokenIn),
        amount: formatAmount(swap.amountIn),
      },
      destination: {
        token: tokenView(swap.tokenOut),
        amount: formatAmount(swap.amountOut),
      },
      confidence: update.confidence,
      sourceCount: 1,
    },
  };
}

function formatRoute(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^\d/.test(part)) return part;
      if (part.length <= 3 && part === part.toUpperCase()) return part;
      return part[0]!.toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function tokenView(value: string): AlertTokenView {
  const sym = formatTokenSymbol(value);
  return {
    sym,
    color: colorFor(value),
    icon: iconFor(sym),
  };
}

function formatTokenSymbol(value: string): string {
  const trimmed = value.trim();
  if (ADDRESS_RE.test(trimmed)) return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  return trimmed || "Token";
}

function formatAmount(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 14) return trimmed;
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return `${trimmed.slice(0, 9)}...${trimmed.slice(-4)}`;
}

function iconFor(symbol: string): string {
  const first = symbol.replace(/^0x/i, "").match(/[a-z0-9]/i)?.[0];
  return first ? first.toUpperCase() : "#";
}

function colorFor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 68% 46%)`;
}
