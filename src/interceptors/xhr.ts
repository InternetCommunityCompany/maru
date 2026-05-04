import type { InterceptedEvent } from "./types";
import { makeIdGenerator } from "./make-id-generator";

type Tracked = {
  id: string;
  method: string;
  url: string;
  requestBody: string | null;
};

const trackedSym = Symbol("maru-xhr");

/**
 * Patches `XMLHttpRequest.prototype` to emit `InterceptedEvent`s for every call.
 *
 * Must be called at `document_start`. The patch wraps `open` to capture the
 * URL/method, `send` to capture the body and emit a `request` event, and
 * subscribes to `loadend` to emit `response` or `error`. Response bodies are
 * only captured for `responseType === ""` or `"text"`; binary/JSON-typed
 * responses leave `responseBody` as `null`.
 */
export function installXhrInterceptor(
  emit: (event: InterceptedEvent) => void,
): void {
  const nextId = makeIdGenerator("xhr");
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    (this as unknown as Record<symbol, Tracked>)[trackedSym] = {
      id: nextId(),
      method,
      url: typeof url === "string" ? url : url.toString(),
      requestBody: null,
    };
    return origOpen.apply(this, [
      method,
      url,
      ...rest,
    ] as unknown as Parameters<typeof origOpen>);
  };

  XMLHttpRequest.prototype.send = function patchedSend(
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const tracked = (this as unknown as Record<symbol, Tracked | undefined>)[
      trackedSym
    ];
    if (tracked) {
      tracked.requestBody = typeof body === "string" ? body : null;
      emit({
        source: "xhr",
        phase: "request",
        id: tracked.id,
        url: tracked.url,
        method: tracked.method,
        requestBody: tracked.requestBody,
      });
      this.addEventListener("loadend", () => {
        const errored = this.readyState !== 4 || this.status === 0;
        if (errored) {
          emit({
            source: "xhr",
            phase: "error",
            id: tracked.id,
            url: tracked.url,
            method: tracked.method,
            requestBody: tracked.requestBody,
            error: "network error",
          });
          return;
        }
        let responseBody: string | null = null;
        try {
          if (this.responseType === "" || this.responseType === "text") {
            responseBody = this.responseText;
          }
        } catch {
          // not readable
        }
        emit({
          source: "xhr",
          phase: "response",
          id: tracked.id,
          url: tracked.url,
          method: tracked.method,
          status: this.status,
          requestBody: tracked.requestBody,
          responseBody,
        });
      });
    }
    return origSend.call(this, body);
  };
}
