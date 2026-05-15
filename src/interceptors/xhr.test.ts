// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterceptedEvent } from "./install-interceptors";
import { installXhrInterceptor } from "./xhr";

type XhrEvent = Extract<InterceptedEvent, { source: "xhr" }>;
type Emit = ReturnType<typeof vi.fn<(event: InterceptedEvent) => void>>;

// All events captured in this file come from the xhr interceptor; the helper
// narrows the union once so individual assertions can read xhr-specific
// fields like `responseBody` without repeating the discriminant.
const xhrCalls = (m: Emit): XhrEvent[] =>
  m.mock.calls.map((c) => c[0] as XhrEvent);

// The interceptor patches `XMLHttpRequest.prototype.open/send` in place, so
// each test snapshots the originals and restores them on teardown. The
// pre-test replacements are no-op mocks — that way the `origSend` captured by
// the interceptor doesn't fire a real network request out of happy-dom.
let originalOpen: XMLHttpRequest["open"];
let originalSend: XMLHttpRequest["send"];
let emit: Emit;

beforeEach(() => {
  originalOpen = XMLHttpRequest.prototype.open;
  originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = vi.fn();
  XMLHttpRequest.prototype.send = vi.fn();
  emit = vi.fn();
});

afterEach(() => {
  XMLHttpRequest.prototype.open = originalOpen;
  XMLHttpRequest.prototype.send = originalSend;
  vi.restoreAllMocks();
});

const setState = (
  xhr: XMLHttpRequest,
  state: { readyState?: number; status?: number; responseText?: string },
) => {
  for (const [key, value] of Object.entries(state)) {
    Object.defineProperty(xhr, key, { value, configurable: true });
  }
};

const completeAs = (
  xhr: XMLHttpRequest,
  state: { readyState?: number; status?: number; responseText?: string },
) => {
  setState(xhr, {
    readyState: state.readyState ?? 4,
    status: state.status ?? 200,
    responseText: state.responseText ?? "",
  });
  xhr.dispatchEvent(new Event("loadend"));
};

describe("installXhrInterceptor", () => {
  describe("transparency", () => {
    it("delegates open/send to the original implementations", () => {
      const openMock = XMLHttpRequest.prototype.open as ReturnType<
        typeof vi.fn
      >;
      const sendMock = XMLHttpRequest.prototype.send as ReturnType<
        typeof vi.fn
      >;
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.example.com/x");
      xhr.send("body");

      expect(openMock).toHaveBeenCalledWith(
        "POST",
        "https://api.example.com/x",
      );
      expect(sendMock).toHaveBeenCalledWith("body");
    });
  });

  describe("event emission", () => {
    it("emits a request event when send is called", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.example.com/x");
      xhr.send("payload");

      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit.mock.calls[0][0]).toMatchObject({
        source: "xhr",
        phase: "request",
        url: "https://api.example.com/x",
        method: "POST",
        requestBody: "payload",
      });
    });

    it("emits a response event on a successful loadend", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "https://api.example.com/x");
      xhr.send();
      completeAs(xhr, {
        readyState: 4,
        status: 200,
        responseText: '{"ok":true}',
      });

      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit.mock.calls[1][0]).toMatchObject({
        source: "xhr",
        phase: "response",
        status: 200,
        responseBody: '{"ok":true}',
      });
    });

    it("correlates request and response phases with the same id", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "https://api.example.com/x");
      xhr.send();
      completeAs(xhr, {});

      const [req, res] = emit.mock.calls.map((c) => c[0]);
      expect(req.id).toBe(res.id);
    });

    it("uses distinct ids across independent XHR instances", () => {
      installXhrInterceptor(emit);

      const a = new XMLHttpRequest();
      const b = new XMLHttpRequest();
      a.open("GET", "/a");
      b.open("GET", "/b");
      a.send();
      b.send();

      const ids = new Set(emit.mock.calls.map((c) => c[0].id));
      expect(ids.size).toBe(2);
    });

    it("emits an error phase when readyState != 4 on loadend", () => {
      // E.g. abort()ed requests don't reach readyState 4 but still fire loadend.
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "https://api.example.com/x");
      xhr.send();
      completeAs(xhr, { readyState: 3, status: 200 });

      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit.mock.calls[1][0]).toMatchObject({
        phase: "error",
        error: "network error",
      });
    });

    it("emits an error phase when status is 0 (network failure)", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "https://api.example.com/x");
      xhr.send();
      completeAs(xhr, { readyState: 4, status: 0 });

      expect(emit.mock.calls[1][0]).toMatchObject({
        phase: "error",
        error: "network error",
      });
    });

    it("does not emit anything when send is called without a prior open", () => {
      // open() is what stamps the tracking marker; send() without it should
      // pass straight through to the original.
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.send("body");

      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe("url normalisation", () => {
    it("preserves a string url verbatim", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "https://api.example.com/x?q=1");
      xhr.send();

      expect(xhrCalls(emit)[0].url).toBe("https://api.example.com/x?q=1");
    });

    it("serialises URL objects to string", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", new URL("https://api.example.com/x"));
      xhr.send();

      expect(xhrCalls(emit)[0].url).toBe("https://api.example.com/x");
    });
  });

  describe("request body capture", () => {
    it("captures string bodies", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/x");
      xhr.send("hello");

      expect(xhrCalls(emit)[0].requestBody).toBe("hello");
    });

    it("returns null for non-string body types", () => {
      // FormData / Blob / ArrayBuffer aren't useful to the matchers and may be
      // huge; we deliberately don't try to read them.
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/x");
      const blob = new Blob(["binary"]);
      xhr.send(blob);

      expect(xhrCalls(emit)[0].requestBody).toBeNull();
    });

    it("returns null when send is called with no body", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "/x");
      xhr.send();

      expect(xhrCalls(emit)[0].requestBody).toBeNull();
    });

    it("repeats the captured request body on the response event", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/x");
      xhr.send("payload");
      completeAs(xhr, {});

      expect(xhrCalls(emit)[1].requestBody).toBe("payload");
    });
  });

  describe("response body capture", () => {
    it("captures responseText when responseType is the default", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "/x");
      xhr.send();
      completeAs(xhr, { responseText: "hello" });

      expect(xhrCalls(emit)[1].responseBody).toBe("hello");
    });

    it("captures responseText when responseType is explicitly 'text'", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "/x");
      xhr.responseType = "text";
      xhr.send();
      completeAs(xhr, { responseText: "hello" });

      expect(xhrCalls(emit)[1].responseBody).toBe("hello");
    });

    it.each(["arraybuffer", "blob", "document", "json"] as const)(
      "skips body capture for responseType=%s",
      (responseType) => {
        // The XHR spec forbids reading responseText for these — accessing it
        // would throw on a real XHR. The interceptor opts not to attempt it.
        installXhrInterceptor(emit);

        const xhr = new XMLHttpRequest();
        xhr.open("GET", "/x");
        xhr.responseType = responseType;
        xhr.send();
        completeAs(xhr, { responseText: "ignored" });

        expect(xhrCalls(emit)[1].responseBody).toBeNull();
      },
    );

    it("returns null when responseText access throws", () => {
      installXhrInterceptor(emit);

      const xhr = new XMLHttpRequest();
      xhr.open("GET", "/x");
      xhr.send();
      setState(xhr, { readyState: 4, status: 200 });
      Object.defineProperty(xhr, "responseText", {
        configurable: true,
        get() {
          throw new Error("not readable");
        },
      });
      xhr.dispatchEvent(new Event("loadend"));

      expect(xhrCalls(emit)[1].responseBody).toBeNull();
    });
  });
});
