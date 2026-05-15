import { describe, expect, it } from "vitest";
import type { QuoteUpdate } from "@/arbiter/types";
import type { SwapEvent } from "@/template-engine/types";
import { toAlertView } from "./to-alert-view";

const swap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "uniswap-v2-router",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  tokenOut: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  amountIn: "1000000",
  amountOut: "500000000000000000",
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

describe("toAlertView", () => {
  it("maps a live swap quote into card props without demo constants", () => {
    const view = toAlertView(update());

    expect(view.state).toBe("better");
    if (view.state !== "better") throw new Error("expected better view");
    expect(view.card.mode).toBe("swap");
    expect(view.card.route).toBe("Uniswap V2 Router");
    expect(view.card.source.amount).toBe("1000000");
    expect(view.card.destination.amount).toBe("500000000...0000");
    expect(view.card.source.token.sym).toBe("0xa0b8...eb48");
    expect(view.card.destination.token.sym).toBe("0xc02a...6cc2");
    expect(view.card.sequence).toBe(1);
    expect(view.card.confidence).toBe(0.6);
  });

  it("maps bridge quotes to the bridge state and prefers provider route labels", () => {
    const view = toAlertView(
      update({
        swap: swap({
          type: "bridge",
          chainOut: 42161,
          provider: "stargate",
          tokenIn: "USDC",
          tokenOut: "ARB",
          amountIn: "100",
          amountOut: "100.46",
        }),
      }),
    );

    expect(view.state).toBe("bridge");
    if (view.state !== "bridge") throw new Error("expected bridge view");
    expect(view.card.mode).toBe("bridge");
    expect(view.card.route).toBe("Stargate");
    expect(view.card.source.token.sym).toBe("USDC");
    expect(view.card.destination.token.sym).toBe("ARB");
    expect(view.card.destination.amount).toBe("100.46");
  });
});
