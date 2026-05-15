import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing";
import { ensureTokenList, TOKEN_LIST_TTL_MS } from "./ensure-token-list";
import { lookupToken, tokenIndexSize } from "./token-index";
import { tokenList } from "./token-list-storage";
import type { TokenList } from "./types";

const usdc = {
  chainId: 1,
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  decimals: 6,
  symbol: "USDC",
  name: "USD Coin",
};

const sample: TokenList = { tokens: [usdc] };

const responseOf = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(async () => {
  // Reset both the persisted blob and the in-memory index between cases.
  fakeBrowser.reset();
  await tokenList.removeValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureTokenList: cold install", () => {
  it("fetches, persists, and hydrates on the first call", async () => {
    // The fallback `fetchedAt: 0` is epoch — any realistic `Date.now()`
    // sits well past the TTL relative to it, so the cold install always
    // triggers a refresh.
    const now = 1_700_000_000_000;
    const fetchImpl = vi.fn(async () => responseOf(sample));
    await ensureTokenList({ fetchImpl, now: () => now });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const stored = await tokenList.getValue();
    expect(stored.fetchedAt).toBe(now);
    expect(stored.data.tokens).toHaveLength(1);
    expect(lookupToken(1, usdc.address)?.symbol).toBe("USDC");
  });
});

describe("ensureTokenList: TTL behaviour", () => {
  it("skips the network when the stored copy is fresh", async () => {
    await tokenList.setValue({ data: sample, fetchedAt: 100 });
    const fetchImpl = vi.fn(async () => responseOf({ tokens: [] }));

    await ensureTokenList({ fetchImpl, now: () => 100 + TOKEN_LIST_TTL_MS });

    expect(fetchImpl).not.toHaveBeenCalled();
    // The persisted copy must still hydrate the index — that's the
    // service-worker-restart path.
    expect(lookupToken(1, usdc.address)?.symbol).toBe("USDC");
  });

  it("refreshes when the stored copy is past the TTL", async () => {
    await tokenList.setValue({ data: { tokens: [] }, fetchedAt: 0 });
    const fetchImpl = vi.fn(async () => responseOf(sample));

    await ensureTokenList({
      fetchImpl,
      now: () => TOKEN_LIST_TTL_MS + 1,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(lookupToken(1, usdc.address)?.symbol).toBe("USDC");
    const stored = await tokenList.getValue();
    expect(stored.fetchedAt).toBe(TOKEN_LIST_TTL_MS + 1);
  });
});

describe("ensureTokenList: failure modes are non-fatal", () => {
  it("falls back to the existing stored copy on an HTTP error", async () => {
    await tokenList.setValue({ data: sample, fetchedAt: 0 });
    const fetchImpl = vi.fn(async () => responseOf({ error: "down" }, 503));

    await ensureTokenList({ fetchImpl, now: () => TOKEN_LIST_TTL_MS + 1 });

    expect(lookupToken(1, usdc.address)?.symbol).toBe("USDC");
    // Persisted timestamp must NOT advance — next call should re-attempt.
    const stored = await tokenList.getValue();
    expect(stored.fetchedAt).toBe(0);
  });

  it("falls back on a network error", async () => {
    await tokenList.setValue({ data: sample, fetchedAt: 0 });
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });

    await ensureTokenList({ fetchImpl, now: () => TOKEN_LIST_TTL_MS + 1 });

    expect(lookupToken(1, usdc.address)?.symbol).toBe("USDC");
  });

  it("falls back on a malformed response body", async () => {
    await tokenList.setValue({ data: sample, fetchedAt: 0 });
    const fetchImpl = vi.fn(async () => responseOf({ not: "a list" }));

    await ensureTokenList({ fetchImpl, now: () => TOKEN_LIST_TTL_MS + 1 });

    expect(lookupToken(1, usdc.address)?.symbol).toBe("USDC");
  });

  it("yields an empty index after a failed cold install", async () => {
    // No prior persisted value — the fallback empty list is what hydrates.
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });

    await ensureTokenList({ fetchImpl, now: () => 1_000 });

    expect(tokenIndexSize()).toBe(0);
    expect(lookupToken(1, usdc.address)).toBeNull();
  });
});

describe("ensureTokenList: SW-restart path", () => {
  it("hydrates the in-memory index from storage even when the cache is fresh", async () => {
    // Simulate a previous SW that fetched the list; this run is the post-
    // restart boot — fetch must not be called, but the index must be warm.
    await tokenList.setValue({ data: sample, fetchedAt: 100 });
    const fetchImpl = vi.fn();

    await ensureTokenList({ fetchImpl, now: () => 200 });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(lookupToken(1, usdc.address)?.symbol).toBe("USDC");
  });
});
