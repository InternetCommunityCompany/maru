import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBestQuote } from "./fetch-best-quote";
import type { QuoteRequest } from "./types";

const req: QuoteRequest = {
  chainIn: 1,
  chainOut: 1,
  tokenIn: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  tokenOut: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  amount: "1000000",
  kind: "exact_in",
};

const okBody = {
  provider: "uniswap",
  amountOut: "510000000000000000",
  fetchedAt: 1_700_000_000_000,
  raw: { foo: "bar" },
};

const responseWith = (
  init: { status: number; body?: unknown } = { status: 200, body: okBody },
): Response => {
  const body =
    init.body === undefined ? null : JSON.stringify(init.body ?? null);
  return new Response(body, {
    status: init.status,
    headers: init.body !== undefined ? { "content-type": "application/json" } : {},
  });
};

describe("fetchBestQuote: HTTP outcomes", () => {
  it("returns ok with parsed BestQuote on 200", async () => {
    const fetchImpl = vi.fn(async () => responseWith({ status: 200, body: okBody }));
    const result = await fetchBestQuote(req, { fetchImpl });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.quote.provider).toBe("uniswap");
    expect(result.quote.amountOut).toBe("510000000000000000");
  });

  it("returns no_opinion on 204", async () => {
    const fetchImpl = vi.fn(async () => responseWith({ status: 204 }));
    const result = await fetchBestQuote(req, { fetchImpl });
    expect(result.status).toBe("no_opinion");
  });

  it("returns failed on 5xx", async () => {
    const fetchImpl = vi.fn(async () => responseWith({ status: 503, body: { error: "down" } }));
    const result = await fetchBestQuote(req, { fetchImpl });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("expected failed");
    expect(result.reason).toBe("http_503");
  });

  it("returns failed on 4xx", async () => {
    const fetchImpl = vi.fn(async () => responseWith({ status: 400, body: { error: "bad" } }));
    const result = await fetchBestQuote(req, { fetchImpl });
    expect(result.status).toBe("failed");
  });

  it("returns failed on malformed body (missing provider)", async () => {
    const fetchImpl = vi.fn(async () =>
      responseWith({ status: 200, body: { amountOut: "1" } }),
    );
    const result = await fetchBestQuote(req, { fetchImpl });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("expected failed");
    expect(result.reason).toBe("malformed_response");
  });

  it("returns failed on network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network");
    });
    const result = await fetchBestQuote(req, { fetchImpl });
    expect(result.status).toBe("failed");
  });

  it("posts to /api/quotes with the request body", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return responseWith({ status: 200, body: okBody });
    };
    await fetchBestQuote(req, { fetchImpl });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toMatch(/\/api\/quotes$/);
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual(req);
  });
});

describe("fetchBestQuote: timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts and returns failed:timeout when the request exceeds the deadline", async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const promise = fetchBestQuote(req, { fetchImpl, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("expected failed");
    expect(result.reason).toBe("timeout");
  });
});

describe("fetchBestQuote: abort", () => {
  it("returns aborted when signal aborts before the call", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => responseWith({ status: 200, body: okBody }));
    const result = await fetchBestQuote(req, {
      fetchImpl,
      signal: controller.signal,
    });
    expect(result.status).toBe("aborted");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns aborted when signal aborts during the request", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const promise = fetchBestQuote(req, {
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    const result = await promise;
    expect(result.status).toBe("aborted");
  });
});
