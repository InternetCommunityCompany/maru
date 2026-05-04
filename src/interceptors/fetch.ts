import type { InterceptedEvent } from "@/types";
import { makeIdGenerator, safeText } from "./util";

export function installFetchInterceptor(
  emit: (event: InterceptedEvent) => void,
): void {
  const originalFetch = window.fetch;
  const nextId = makeIdGenerator("fetch");

  window.fetch = async function patchedFetch(
    ...args: Parameters<typeof fetch>
  ): Promise<Response> {
    const [input, init] = args;
    const id = nextId();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");

    const requestBody = await safeText(async () => {
      if (init?.body && typeof init.body === "string") return init.body;
      if (input instanceof Request) return input.clone().text();
      return null;
    });

    emit({ source: "fetch", phase: "request", id, url, method, requestBody });

    try {
      const response = await originalFetch.apply(this, args);
      const responseBody = await safeText(() => response.clone().text());
      emit({
        source: "fetch",
        phase: "response",
        id,
        url,
        method,
        status: response.status,
        ok: response.ok,
        responseBody,
        requestBody,
      });
      return response;
    } catch (err) {
      emit({
        source: "fetch",
        phase: "error",
        id,
        url,
        method,
        requestBody,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}
