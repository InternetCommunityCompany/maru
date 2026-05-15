// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterceptedEvent } from "./types";
import { installFetchInterceptor } from "./fetch";

type FetchEvent = Extract<InterceptedEvent, { source: "fetch" }>;
type Emit = ReturnType<typeof vi.fn<(event: InterceptedEvent) => void>>;

// Tests in this file only exercise the fetch interceptor, so every event the
// mock sees is the fetch variant. This helper narrows the union once at the
// call site so each assertion doesn't have to repeat the discriminant check.
const fetchCalls = (m: Emit): FetchEvent[] =>
  m.mock.calls.map((c) => c[0] as FetchEvent);

// Re-stub `window.fetch` on every test so the interceptor wraps a fresh
// mock — the patch is sticky once installed, so a one-shot beforeEach keeps
// each test isolated to its own mock without re-installing the interceptor.
let originalFetch: typeof window.fetch;
let emit: Emit;

beforeEach(() => {
  originalFetch = window.fetch;
  emit = vi.fn();
});

afterEach(() => {
  window.fetch = originalFetch;
  vi.restoreAllMocks();
});

const mockFetch = (response: Response): typeof window.fetch => {
  const fn = vi.fn(async () => response);
  window.fetch = fn as unknown as typeof window.fetch;
  return window.fetch;
};

const mockFetchError = (err: unknown): typeof window.fetch => {
  const fn = vi.fn(async () => {
    throw err;
  });
  window.fetch = fn as unknown as typeof window.fetch;
  return window.fetch;
};

describe("installFetchInterceptor", () => {
  describe("transparency", () => {
    it("returns the underlying Response unchanged", async () => {
      const response = new Response("hello", { status: 200 });
      mockFetch(response);
      installFetchInterceptor(emit);

      const result = await window.fetch("https://api.example.com/x");
      expect(await result.text()).toBe("hello");
      expect(result.status).toBe(200);
    });

    it("re-throws errors from the underlying fetch", async () => {
      mockFetchError(new TypeError("offline"));
      installFetchInterceptor(emit);

      await expect(window.fetch("https://api.example.com/x")).rejects.toThrow(
        "offline",
      );
    });

    it("delegates to the original fetch with the original arguments", async () => {
      const response = new Response("ok");
      const underlying = mockFetch(response);
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x", { method: "POST" });
      expect(underlying).toHaveBeenCalledTimes(1);
      expect(underlying).toHaveBeenCalledWith("https://api.example.com/x", {
        method: "POST",
      });
    });
  });

  describe("event emission", () => {
    it("emits a request event before invoking the underlying fetch", async () => {
      // The request event must arrive before the round-trip starts so
      // consumers can see in-flight calls without waiting on slow responses.
      const order: string[] = [];
      window.fetch = vi.fn(async () => {
        order.push("fetch");
        return new Response("ok");
      }) as unknown as typeof window.fetch;
      installFetchInterceptor(emit);
      emit.mockImplementation((event) => {
        order.push(event.phase);
      });

      await window.fetch("https://api.example.com/x");
      expect(order[0]).toBe("request");
      expect(order).toContain("fetch");
      expect(order.indexOf("request")).toBeLessThan(order.indexOf("fetch"));
    });

    it("emits a matching response event after the round-trip", async () => {
      mockFetch(new Response("body", { status: 201 }));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x");
      expect(emit).toHaveBeenCalledTimes(2);
      const [, response] = emit.mock.calls.map((c) => c[0]);
      expect(response).toMatchObject({
        source: "fetch",
        phase: "response",
        url: "https://api.example.com/x",
        status: 201,
        ok: true,
        responseBody: "body",
      });
    });

    it("emits an error event when the underlying fetch throws", async () => {
      mockFetchError(new Error("DNS failure"));
      installFetchInterceptor(emit);

      await expect(window.fetch("https://api.example.com/x")).rejects.toThrow();

      const phases = emit.mock.calls.map((c) => c[0].phase);
      expect(phases).toEqual(["request", "error"]);
      expect(emit.mock.calls[1][0]).toMatchObject({
        source: "fetch",
        phase: "error",
        error: "DNS failure",
      });
    });

    it("stringifies non-Error throws on the error event", async () => {
      mockFetchError("legacy string error");
      installFetchInterceptor(emit);

      await expect(window.fetch("https://api.example.com/x")).rejects.toBe(
        "legacy string error",
      );
      expect(emit.mock.calls[1][0]).toMatchObject({
        phase: "error",
        error: "legacy string error",
      });
    });

    it("correlates request and response phases with the same id", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x");
      const [req, res] = emit.mock.calls.map((c) => c[0]);
      expect(req.id).toBe(res.id);
    });

    it("assigns distinct ids across separate calls", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/a");
      await window.fetch("https://api.example.com/b");
      const ids = new Set(emit.mock.calls.map((c) => c[0].id));
      expect(ids.size).toBe(2);
    });
  });

  describe("url normalisation", () => {
    it("preserves a string input verbatim", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/path?q=1");
      expect(emit.mock.calls[0][0]).toMatchObject({
        url: "https://api.example.com/path?q=1",
      });
    });

    it("serialises a URL object to its string form", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch(new URL("https://api.example.com/path?q=1"));
      expect(fetchCalls(emit)[0].url).toBe(
        "https://api.example.com/path?q=1",
      );
    });

    it("reads the url off a Request object", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      const request = new Request("https://api.example.com/from-request");
      await window.fetch(request);
      expect(fetchCalls(emit)[0].url).toBe(
        "https://api.example.com/from-request",
      );
    });
  });

  describe("method resolution", () => {
    it("defaults to GET when no method is given", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x");
      expect(emit.mock.calls[0][0].method).toBe("GET");
    });

    it("uses the init.method when provided", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x", { method: "POST" });
      expect(emit.mock.calls[0][0].method).toBe("POST");
    });

    it("falls back to a Request's method when init is absent", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      const request = new Request("https://api.example.com/x", {
        method: "DELETE",
      });
      await window.fetch(request);
      expect(emit.mock.calls[0][0].method).toBe("DELETE");
    });

    it("prefers init.method over a Request's method when both are given", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      const request = new Request("https://api.example.com/x", {
        method: "DELETE",
      });
      await window.fetch(request, { method: "PUT" });
      expect(emit.mock.calls[0][0].method).toBe("PUT");
    });
  });

  describe("request body capture", () => {
    it("captures a string init.body", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x", {
        method: "POST",
        body: '{"foo":"bar"}',
      });
      expect(emit.mock.calls[0][0]).toMatchObject({
        requestBody: '{"foo":"bar"}',
      });
    });

    it("reads the body off a Request via clone().text()", async () => {
      // Cloning ensures the dapp's downstream `request.text()` still works —
      // a non-cloned read would lock the stream and break the page.
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      const request = new Request("https://api.example.com/x", {
        method: "POST",
        body: "from-request",
      });
      await window.fetch(request);
      expect(fetchCalls(emit)[0].requestBody).toBe("from-request");
      // The original request body is still readable downstream.
      expect(await request.text()).toBe("from-request");
    });

    it("returns null when no body is supplied", async () => {
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x");
      expect(fetchCalls(emit)[0].requestBody).toBeNull();
    });

    it("returns null for non-string init.body shapes", async () => {
      // FormData / Blob / ArrayBuffer are intentionally not captured — they
      // aren't useful to the heuristic / template engines and reading them
      // can be expensive.
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      const form = new FormData();
      form.append("k", "v");
      await window.fetch("https://api.example.com/x", {
        method: "POST",
        body: form,
      });
      expect(fetchCalls(emit)[0].requestBody).toBeNull();
    });

    it("repeats the captured request body on the response event", async () => {
      // The template/heuristic engines run against the response event and
      // need the request body alongside the response — passing it through
      // saves consumers from having to correlate ids themselves.
      mockFetch(new Response("ok"));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x", {
        method: "POST",
        body: "req",
      });
      const [req, res] = fetchCalls(emit);
      expect(req.requestBody).toBe("req");
      expect(res.requestBody).toBe("req");
    });
  });

  describe("response body capture", () => {
    it("clones the response before reading so the dapp can still consume it", async () => {
      const response = new Response("payload");
      mockFetch(response);
      installFetchInterceptor(emit);

      const result = await window.fetch("https://api.example.com/x");
      expect(fetchCalls(emit)[1].responseBody).toBe("payload");
      // Downstream caller can still read the body without the patch interfering.
      expect(await result.text()).toBe("payload");
    });

    it("marks ok=false on non-2xx responses", async () => {
      mockFetch(new Response("nope", { status: 404 }));
      installFetchInterceptor(emit);

      await window.fetch("https://api.example.com/x");
      expect(emit.mock.calls[1][0]).toMatchObject({
        status: 404,
        ok: false,
      });
    });
  });
});
