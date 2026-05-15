import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterceptedEvent } from "@/interceptors/install-interceptors";
import { heuristicMatch } from "./heuristic-match";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const WALLET = "0x1111111111111111111111111111111111111111";
const ZERO = "0x0000000000000000000000000000000000000000";
const NATIVE_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const PAGE_HOST = "app.example.xyz";

type FetchOverrides = Partial<Extract<InterceptedEvent, { source: "fetch" }>>;

const fetchEvent = (overrides: FetchOverrides = {}): InterceptedEvent => ({
  source: "fetch",
  phase: "response",
  id: "evt-1",
  url: "https://api.example.com/v1/quote",
  method: "POST",
  status: 200,
  ok: true,
  ...overrides,
});

const swapBody = (
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  fromTokenAddress: USDC,
  toTokenAddress: WETH,
  fromAmount: "1000000",
  toAmount: "500000000000000000",
  fromChainId: 1,
  toChainId: 1,
  ...extra,
});

describe("heuristicMatch", () => {
  // The matcher leaves a debug dump in place; silence it during tests so
  // it doesn't drown the runner output. Remove this when the log is removed.
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("gates", () => {
    it("rejects ethereum-source events", () => {
      const event: InterceptedEvent = {
        source: "ethereum",
        phase: "response",
        id: "rpc-1",
        method: "eth_sendTransaction",
      };
      expect(heuristicMatch(event, PAGE_HOST)).toBeNull();
    });

    it("rejects non-response phases", () => {
      const req = fetchEvent({
        phase: "request",
        requestBody: JSON.stringify(swapBody()),
      });
      expect(heuristicMatch(req, PAGE_HOST)).toBeNull();

      const err = fetchEvent({
        phase: "error",
        requestBody: JSON.stringify(swapBody()),
      });
      expect(heuristicMatch(err, PAGE_HOST)).toBeNull();
    });

    it("accepts any HTTP method as long as the shape checks pass", () => {
      // The verb isn't load-bearing — the per-field validators (address regex,
      // non-zero amounts, positive chain id) already exclude non-swap traffic.
      for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
        const event = fetchEvent({
          method,
          requestBody: JSON.stringify(swapBody()),
        });
        expect(heuristicMatch(event, PAGE_HOST)?.kind).toBe("swap");
      }
    });

    it("rejects non-2xx status codes", () => {
      for (const status of [199, 300, 404, 500]) {
        const event = fetchEvent({
          status,
          requestBody: JSON.stringify(swapBody()),
        });
        expect(heuristicMatch(event, PAGE_HOST)).toBeNull();
      }
    });

    it("accepts status codes across the full 2xx range", () => {
      for (const status of [200, 201, 204, 299]) {
        const event = fetchEvent({
          status,
          requestBody: JSON.stringify(swapBody()),
        });
        expect(heuristicMatch(event, PAGE_HOST)?.kind).toBe("swap");
      }
    });

    it("accepts events without a status field at all", () => {
      const event = fetchEvent({
        status: undefined,
        requestBody: JSON.stringify(swapBody()),
      });
      expect(heuristicMatch(event, PAGE_HOST)?.kind).toBe("swap");
    });

    it("rejects events with no parseable body and no query params", () => {
      const event = fetchEvent({
        requestBody: null,
        responseBody: null,
        url: "https://api.example.com/v1/quote",
      });
      expect(heuristicMatch(event, PAGE_HOST)).toBeNull();
    });

    it("rejects events whose bodies fail to parse as JSON", () => {
      const event = fetchEvent({
        requestBody: "not-json",
        responseBody: "<html>oops</html>",
      });
      expect(heuristicMatch(event, PAGE_HOST)).toBeNull();
    });
  });

  describe("happy paths", () => {
    it("extracts all required fields from the request body", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify(
          swapBody({ fromAddress: WALLET }),
        ),
      });
      expect(heuristicMatch(event, PAGE_HOST)).toEqual({
        kind: "swap",
        type: "swap",
        templateId: "heuristic",
        domain: PAGE_HOST,
        chainIn: 1,
        chainOut: 1,
        tokenIn: USDC,
        tokenOut: WETH,
        amountIn: "1000000",
        amountOut: "500000000000000000",
        fromAddress: WALLET,
        transport: {
          source: "fetch",
          url: "https://api.example.com/v1/quote",
          method: "POST",
        },
      });
    });

    it("extracts fields from the response body when the request is empty", () => {
      const event = fetchEvent({
        requestBody: null,
        responseBody: JSON.stringify(swapBody()),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.tokenIn).toBe(USDC);
      expect(result?.amountOut).toBe("500000000000000000");
    });

    it("merges fields across the request and response bodies", () => {
      // Common shape: request carries the inputs, response carries the
      // quoted output amount.
      const event = fetchEvent({
        requestBody: JSON.stringify({
          fromTokenAddress: USDC,
          toTokenAddress: WETH,
          fromAmount: "1000000",
          chainId: 1,
        }),
        responseBody: JSON.stringify({ toAmount: "500000000000000000" }),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.amountIn).toBe("1000000");
      expect(result?.amountOut).toBe("500000000000000000");
      expect(result?.chainIn).toBe(1);
      expect(result?.chainOut).toBe(1);
    });

    it("resolves nested aliases like `fromToken.address`", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify({
          fromToken: { address: USDC },
          toToken: { address: WETH },
          fromAmount: "1000000",
          toAmount: "500000000000000000",
          chainId: 137,
        }),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.tokenIn).toBe(USDC);
      expect(result?.tokenOut).toBe(WETH);
      expect(result?.chainIn).toBe(137);
      expect(result?.chainOut).toBe(137);
    });

    it("drops the event when any required field cannot be resolved", () => {
      // Missing `toAmount` everywhere.
      const event = fetchEvent({
        requestBody: JSON.stringify({
          fromTokenAddress: USDC,
          toTokenAddress: WETH,
          fromAmount: "1000000",
          chainId: 1,
        }),
      });
      expect(heuristicMatch(event, PAGE_HOST)).toBeNull();
    });

    it("drops the event when an amount fails its shape check", () => {
      // amountIn must be a non-zero digit string.
      const event = fetchEvent({
        requestBody: JSON.stringify(swapBody({ fromAmount: "0" })),
      });
      expect(heuristicMatch(event, PAGE_HOST)).toBeNull();
    });

    it("leaves fromAddress unset when no alias resolves", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify(swapBody()),
      });
      expect(heuristicMatch(event, PAGE_HOST)?.fromAddress).toBeUndefined();
    });

    it("does not set a provider field on heuristic matches", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify(swapBody()),
      });
      expect(heuristicMatch(event, PAGE_HOST)?.provider).toBeUndefined();
    });

    it("uses the caller-supplied page host as the event domain", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify(swapBody()),
      });
      expect(heuristicMatch(event, "jumper.exchange")?.domain).toBe(
        "jumper.exchange",
      );
    });

    it("preserves the original request URL and method on transport", () => {
      const event = fetchEvent({
        url: "https://api.1inch.io/v5.0/1/quote?chainId=1",
        requestBody: JSON.stringify(swapBody()),
      });
      expect(heuristicMatch(event, PAGE_HOST)?.transport).toEqual({
        source: "fetch",
        url: "https://api.1inch.io/v5.0/1/quote?chainId=1",
        method: "POST",
      });
    });

    it("works for xhr-source events the same way it does for fetch", () => {
      const event: InterceptedEvent = {
        source: "xhr",
        phase: "response",
        id: "xhr-1",
        url: "https://api.example.com/v1/quote",
        method: "POST",
        status: 200,
        requestBody: JSON.stringify(swapBody()),
      };
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.kind).toBe("swap");
      expect(result?.transport.source).toBe("xhr");
    });
  });

  describe("URL query parameters", () => {
    it("resolves required fields from the URL when bodies miss them", () => {
      // Single-chain DEX flow where the chain id lives in the query string,
      // not the body. Before URL-aware heuristics this case was dropped.
      const event = fetchEvent({
        url: "https://api.example.com/v1/quote?chainId=1",
        requestBody: JSON.stringify({
          fromTokenAddress: USDC,
          toTokenAddress: WETH,
          fromAmount: "1000000",
          toAmount: "500000000000000000",
        }),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.chainIn).toBe(1);
      expect(result?.chainOut).toBe(1);
    });

    it("prefers a body value over a URL value for the same alias", () => {
      const event = fetchEvent({
        url: "https://api.example.com/v1/quote?chainId=137",
        requestBody: JSON.stringify(swapBody({ fromChainId: 1, toChainId: 1 })),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.chainIn).toBe(1);
      expect(result?.chainOut).toBe(1);
    });

    it("resolves a swap entirely from the URL when no body is present", () => {
      const url =
        `https://api.example.com/v1/quote?` +
        `fromTokenAddress=${USDC}&toTokenAddress=${WETH}` +
        `&fromAmount=1000000&toAmount=500000000000000000&chainId=1`;
      const event = fetchEvent({ url, requestBody: null, responseBody: null });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result).not.toBeNull();
      expect(result?.tokenIn).toBe(USDC);
      expect(result?.chainIn).toBe(1);
    });
  });

  describe("same-chain default", () => {
    it("mirrors chainIn to chainOut when only the input side resolves", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify({
          fromTokenAddress: USDC,
          toTokenAddress: WETH,
          fromAmount: "1000000",
          toAmount: "500000000000000000",
          fromChainId: 1,
        }),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.chainIn).toBe(1);
      expect(result?.chainOut).toBe(1);
      expect(result?.type).toBe("swap");
    });

    it("mirrors chainOut to chainIn when only the output side resolves", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify({
          fromTokenAddress: USDC,
          toTokenAddress: WETH,
          fromAmount: "1000000",
          toAmount: "500000000000000000",
          toChainId: 137,
        }),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.chainIn).toBe(137);
      expect(result?.chainOut).toBe(137);
      expect(result?.type).toBe("swap");
    });

    it("drops the event when neither chain side can be resolved", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify({
          fromTokenAddress: USDC,
          toTokenAddress: WETH,
          fromAmount: "1000000",
          toAmount: "500000000000000000",
        }),
      });
      expect(heuristicMatch(event, PAGE_HOST)).toBeNull();
    });
  });

  describe("swap vs bridge classification", () => {
    it("classifies equal chains as a swap", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify(swapBody({ fromChainId: 1, toChainId: 1 })),
      });
      expect(heuristicMatch(event, PAGE_HOST)?.type).toBe("swap");
    });

    it("classifies differing chains as a bridge", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify(
          swapBody({ fromChainId: 1, toChainId: 137 }),
        ),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.type).toBe("bridge");
      expect(result?.chainIn).toBe(1);
      expect(result?.chainOut).toBe(137);
    });
  });

  describe("token normalisation", () => {
    it("rewrites native-asset sentinels to the zero address", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify(
          swapBody({ fromTokenAddress: NATIVE_SENTINEL }),
        ),
      });
      expect(heuristicMatch(event, PAGE_HOST)?.tokenIn).toBe(ZERO);
    });

    it("preserves the original casing for plain addresses", () => {
      const checksummed = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
      const event = fetchEvent({
        requestBody: JSON.stringify(
          swapBody({ fromTokenAddress: checksummed }),
        ),
      });
      expect(heuristicMatch(event, PAGE_HOST)?.tokenIn).toBe(checksummed);
    });
  });

  describe("metadata", () => {
    it("tags every emitted event with templateId 'heuristic'", () => {
      const event = fetchEvent({
        requestBody: JSON.stringify(swapBody()),
      });
      expect(heuristicMatch(event, PAGE_HOST)?.templateId).toBe("heuristic");
    });
  });

  describe("amount validators", () => {
    it("accepts numeric amounts and stringifies them", () => {
      // amountIn / amountOut are typed as `string`, but the validator
      // converts numbers so dapps that serialise them numerically still match.
      const event = fetchEvent({
        requestBody: JSON.stringify(
          swapBody({ fromAmount: 1000000, toAmount: 500000 }),
        ),
      });
      const result = heuristicMatch(event, PAGE_HOST);
      expect(result?.amountIn).toBe("1000000");
      expect(result?.amountOut).toBe("500000");
    });

    it("rejects amounts with non-digit characters (decimal strings, hex)", () => {
      const decimal = fetchEvent({
        requestBody: JSON.stringify(swapBody({ fromAmount: "1.5" })),
      });
      expect(heuristicMatch(decimal, PAGE_HOST)).toBeNull();

      const hex = fetchEvent({
        requestBody: JSON.stringify(swapBody({ fromAmount: "0xdeadbeef" })),
      });
      expect(heuristicMatch(hex, PAGE_HOST)).toBeNull();
    });
  });
});
