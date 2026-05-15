// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterceptedEvent } from "./types";
import { installEthereumInterceptor } from "./ethereum";

type EthereumEvent = Extract<InterceptedEvent, { source: "ethereum" }>;
type Emit = ReturnType<typeof vi.fn<(event: InterceptedEvent) => void>>;

const ethCalls = (m: Emit): EthereumEvent[] =>
  m.mock.calls.map((c) => c[0] as EthereumEvent);
type RequestArgs = { method: string; params?: unknown };
type EthereumProvider = {
  request: (args: RequestArgs) => Promise<unknown>;
};

const makeProvider = (
  impl: (args: RequestArgs) => Promise<unknown>,
): EthereumProvider => ({
  request: vi.fn(impl),
});

// The interceptor installs a trap on `window.ethereum` and an
// `eip6963:announceProvider` listener. Reset both between tests so the next
// test sees a clean window.
let emit: Emit;
let listeners: Array<{ type: string; fn: EventListener }> = [];

const originalAdd = window.addEventListener.bind(window);

beforeEach(() => {
  emit = vi.fn();
  listeners = [];
  // Track listeners the interceptor adds so we can remove them on teardown.
  window.addEventListener = ((
    type: string,
    fn: EventListenerOrEventListenerObject,
    opts?: AddEventListenerOptions | boolean,
  ) => {
    listeners.push({ type, fn: fn as EventListener });
    originalAdd(type, fn, opts);
  }) as typeof window.addEventListener;
});

afterEach(() => {
  for (const { type, fn } of listeners) {
    window.removeEventListener(type, fn);
  }
  // Strip the trap so the next test's defineProperty sees a clean slate.
  try {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  } catch {
    // ignore
  }
  window.addEventListener = originalAdd;
  vi.restoreAllMocks();
});

describe("installEthereumInterceptor", () => {
  describe("existing window.ethereum", () => {
    it("patches a provider already on window.ethereum", async () => {
      const provider = makeProvider(async () => "0xresult");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      await provider.request({ method: "eth_chainId" });

      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit.mock.calls[0][0]).toMatchObject({
        source: "ethereum",
        phase: "request",
        method: "eth_chainId",
      });
      expect(emit.mock.calls[1][0]).toMatchObject({
        source: "ethereum",
        phase: "response",
        method: "eth_chainId",
        result: "0xresult",
      });
    });

    it("returns the underlying result unchanged", async () => {
      const provider = makeProvider(async () => "0xabc");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      const result = await provider.request({ method: "eth_chainId" });
      expect(result).toBe("0xabc");
    });

    it("propagates the underlying error and emits an error event", async () => {
      const provider = makeProvider(async () => {
        throw new Error("user rejected");
      });
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      await expect(
        provider.request({ method: "eth_sendTransaction" }),
      ).rejects.toThrow("user rejected");

      expect(emit.mock.calls.map((c) => c[0].phase)).toEqual([
        "request",
        "error",
      ]);
      expect(emit.mock.calls[1][0]).toMatchObject({
        method: "eth_sendTransaction",
        error: "user rejected",
      });
    });

    it("stringifies non-Error throws", async () => {
      const provider = makeProvider(async () => {
        throw "string thrown";
      });
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      await expect(provider.request({ method: "x" })).rejects.toBe(
        "string thrown",
      );
      expect(emit.mock.calls[1][0]).toMatchObject({
        phase: "error",
        error: "string thrown",
      });
    });

    it("uses correlated ids across request and response phases", async () => {
      const provider = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      await provider.request({ method: "eth_chainId" });
      const [req, res] = emit.mock.calls.map((c) => c[0]);
      expect(req.id).toBe(res.id);
    });

    it("uses distinct ids across separate calls", async () => {
      const provider = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      await provider.request({ method: "eth_chainId" });
      await provider.request({ method: "eth_accounts" });

      const requestIds = emit.mock.calls
        .filter((c) => c[0].phase === "request")
        .map((c) => c[0].id);
      expect(new Set(requestIds).size).toBe(2);
    });

    it("forwards params through on every event", async () => {
      const provider = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      const params = [{ from: "0xabc", to: "0xdef", value: "0x1" }];
      await provider.request({ method: "eth_sendTransaction", params });

      expect(emit.mock.calls[0][0]).toMatchObject({ params });
      expect(emit.mock.calls[1][0]).toMatchObject({ params });
    });

    it("falls back to '<unknown>' when the method is missing", async () => {
      const provider = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      await provider.request({} as RequestArgs);
      expect(emit.mock.calls[0][0].method).toBe("<unknown>");
    });

    it("delegates with `this` bound to the original provider", async () => {
      // viem and ethers both rely on `request` being callable as a bare
      // function (no `this`), so the patched version must keep the binding
      // it had at install time.
      const provider: EthereumProvider & { secret: string } = {
        secret: "internal",
        request(args: RequestArgs) {
          return Promise.resolve((this as typeof provider).secret + args.method);
        },
      };
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      const bare = provider.request;
      const result = await bare({ method: "/x" });
      expect(result).toBe("internal/x");
    });
  });

  describe("idempotency", () => {
    it("does not re-patch a provider that's already been patched", async () => {
      const provider = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);
      installEthereumInterceptor(emit);

      await provider.request({ method: "eth_chainId" });
      // One request, one response — not doubled.
      expect(emit).toHaveBeenCalledTimes(2);
    });

    it("ignores providers without a request function", () => {
      // Some wallets stub `window.ethereum` to a sentinel before the real
      // provider lands. Patching those would crash on the first call.
      const broken = { isMetaMask: true } as unknown as EthereumProvider;
      (window as unknown as { ethereum: EthereumProvider }).ethereum = broken;
      expect(() => installEthereumInterceptor(emit)).not.toThrow();
      expect((broken as unknown as { request?: unknown }).request).toBeUndefined();
    });
  });

  describe("late-injected provider", () => {
    it("patches a provider assigned to window.ethereum after install", async () => {
      installEthereumInterceptor(emit);

      const late = makeProvider(async () => "0xchain");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = late;

      await late.request({ method: "eth_chainId" });
      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit.mock.calls[0][0]).toMatchObject({ phase: "request" });
    });

    it("re-reads as the same provider that was assigned", () => {
      installEthereumInterceptor(emit);

      const late = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = late;
      expect(
        (window as unknown as { ethereum: EthereumProvider }).ethereum,
      ).toBe(late);
    });

    it("only patches a re-assigned provider once across multiple sets", async () => {
      installEthereumInterceptor(emit);

      const provider = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;

      await provider.request({ method: "eth_chainId" });
      expect(emit).toHaveBeenCalledTimes(2);
    });
  });

  describe("polling fallback for non-configurable window.ethereum", () => {
    it("polls for late providers when defineProperty throws", async () => {
      vi.useFakeTimers();

      // Force `Object.defineProperty(window, "ethereum", ...)` to throw so the
      // interceptor falls through to the polling branch. Real failure case:
      // wallets that lock `window.ethereum` with a non-configurable descriptor.
      const realDefine = Object.defineProperty;
      const defineSpy = vi
        .spyOn(Object, "defineProperty")
        .mockImplementation((target, key, descriptor) => {
          if (target === window && key === "ethereum") {
            throw new Error("locked");
          }
          return realDefine(target, key, descriptor);
        });

      installEthereumInterceptor(emit);
      // Stop intercepting now so the rest of the test (and teardown) is clean.
      defineSpy.mockRestore();

      const late = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = late;

      // The polling interval is 200ms; advancing once should catch the new
      // provider and patch it.
      await vi.advanceTimersByTimeAsync(250);
      await late.request({ method: "eth_chainId" });

      expect(emit).toHaveBeenCalledTimes(2);

      // The polling stops after 10s — advance past that and reassign; the
      // new provider should not be patched.
      const second = makeProvider(async () => "ok");
      await vi.advanceTimersByTimeAsync(11_000);
      (window as unknown as { ethereum: EthereumProvider }).ethereum = second;
      await vi.advanceTimersByTimeAsync(500);

      await second.request({ method: "eth_chainId" });
      // Still 2 emits — the second provider was never patched.
      expect(emit).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe("EIP-6963", () => {
    it("subscribes and patches providers announced after install", async () => {
      installEthereumInterceptor(emit);

      const provider = makeProvider(async () => "0xchain");
      const info = {
        uuid: "abc-123",
        name: "Test Wallet",
        rdns: "io.test.wallet",
      };
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: { info, provider },
        }),
      );

      await provider.request({ method: "eth_chainId" });
      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit.mock.calls[0][0]).toMatchObject({
        source: "ethereum",
        phase: "request",
        providerInfo: info,
      });
    });

    it("dispatches a requestProvider event to flush already-announced providers", () => {
      const requested = vi.fn();
      originalAdd("eip6963:requestProvider", requested);
      installEthereumInterceptor(emit);

      expect(requested).toHaveBeenCalledTimes(1);
    });

    it("ignores announce events with no provider in the detail", () => {
      installEthereumInterceptor(emit);

      expect(() => {
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: { info: { uuid: "x" } },
          }),
        );
      }).not.toThrow();
    });

    it("doesn't re-patch the same EIP-6963 provider when announced twice", async () => {
      installEthereumInterceptor(emit);

      const provider = makeProvider(async () => "ok");
      const detail = { info: { uuid: "x" }, provider };

      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", { detail }),
      );
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", { detail }),
      );

      await provider.request({ method: "eth_chainId" });
      expect(emit).toHaveBeenCalledTimes(2);
    });

    it("leaves providerInfo undefined for non-EIP-6963 providers", async () => {
      // The legacy `window.ethereum` injection path doesn't carry info — the
      // event shape should reflect that rather than fabricate metadata.
      const provider = makeProvider(async () => "ok");
      (window as unknown as { ethereum: EthereumProvider }).ethereum = provider;
      installEthereumInterceptor(emit);

      await provider.request({ method: "eth_chainId" });
      expect(ethCalls(emit)[0].providerInfo).toBeUndefined();
    });
  });
});
