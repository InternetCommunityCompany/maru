import type { InterceptedEvent } from "@/types";
import { makeIdGenerator } from "./util";

type Tracked = {
  id: string;
  method: string;
  url: string;
  requestBody: string | null;
};

const trackedSym = Symbol("maru-xhr");

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
