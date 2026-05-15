import type { QuoteUpdate } from "@/arbiter/types";
import { BACKEND_URL } from "@/backend-url";

export type BackendQuote = {
  provider: string;
  amountOut: string;
};

export type BackendQuoteClient = (
  update: QuoteUpdate,
) => Promise<BackendQuote | null>;

export function createBackendQuoteClient(
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = fetch,
  baseUrl: string = BACKEND_URL,
): BackendQuoteClient {
  return async (update) => {
    const request = toBackendQuoteRequest(update);
    if (request === null) return null;

    try {
      const response = await fetchImpl(`${baseUrl}/api/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (response.status === 204) return null;
      if (!response.ok) return null;

      const value: unknown = await response.json();
      return isBackendQuote(value) ? value : null;
    } catch {
      return null;
    }
  };
}

export const fetchBackendQuote = createBackendQuoteClient();

function toBackendQuoteRequest(update: QuoteUpdate) {
  const { swap } = update;
  if (swap.chainIn !== swap.chainOut) return null;

  return {
    chainIn: swap.chainIn,
    chainOut: swap.chainOut,
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    amount: swap.amountIn,
    kind: "exact_in",
    ...(isAddress(swap.fromAddress) ? { taker: swap.fromAddress } : {}),
  };
}

function isBackendQuote(value: unknown): value is BackendQuote {
  return (
    isRecord(value) &&
    typeof value.provider === "string" &&
    typeof value.amountOut === "string"
  );
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-f0-9]{40}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
