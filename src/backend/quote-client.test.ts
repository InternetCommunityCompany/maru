import { describe, expect, it, vi } from "vitest";
import type { QuoteUpdate } from "@/arbiter/types";
import type { SwapEvent } from "@/template-engine/types";
import { createBackendQuoteClient } from "./quote-client";

const swap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: "USDC",
  tokenOut: "ETH",
  amountIn: "100",
  amountOut: "1000",
  fromAddress: "0x1111111111111111111111111111111111111111",
  transport: {
    source: "fetch",
    url: "https://api.example.com/quote",
    method: "POST",
  },
  ...overrides,
});

const update = (overrides: Partial<QuoteUpdate> = {}): QuoteUpdate => ({
  swap: swap(),
  sessionKey: "session-a",
  sequence: 1,
  confidence: 0.6,
  candidateId: "cand-1",
  ...overrides,
});

describe("createBackendQuoteClient", () => {
  it("posts an exact-in quote request to the backend", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ provider: "uniswap", amountOut: "1100" }),
    );
    const client = createBackendQuoteClient(fetchImpl, "https://backend.example");

    const quote = await client(update());

    expect(quote).toEqual({ provider: "uniswap", amountOut: "1100" });
    expect(fetchImpl).toHaveBeenCalledWith("https://backend.example/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainIn: 1,
        chainOut: 1,
        tokenIn: "USDC",
        tokenOut: "ETH",
        amount: "100",
        kind: "exact_in",
        taker: "0x1111111111111111111111111111111111111111",
      }),
    });
  });

  it("returns null when no backend source can quote", async () => {
    const client = createBackendQuoteClient(
      async () => new Response(null, { status: 204 }),
      "https://backend.example",
    );

    await expect(client(update())).resolves.toBeNull();
  });

  it("does not call the backend for cross-chain swaps", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ provider: "uniswap", amountOut: "1100" }),
    );
    const client = createBackendQuoteClient(fetchImpl, "https://backend.example");

    const quote = await client(
      update({ swap: swap({ type: "bridge", chainOut: 42161 }) }),
    );

    expect(quote).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
