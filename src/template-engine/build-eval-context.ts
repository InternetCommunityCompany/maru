import type { InterceptedEvent } from "@/interceptors/types";
import type { EvalContext } from "./types";
import { tryParseJson } from "./try-parse-json";

/**
 * Builds the data scope for a template against any `InterceptedEvent`.
 *
 * For fetch/xhr events: decodes both bodies as JSON (silently dropping
 * non-JSON), exposes URL components and the HTTP method. Returns `null` if
 * the URL is malformed.
 *
 * For ethereum events: binds `params`, `result`, and the RPC method name.
 * URL is `undefined` since EIP-1193 calls have no transport URL. Never
 * returns `null` for ethereum events.
 */
export const buildEvalContext = (
  event: InterceptedEvent,
): EvalContext | null => {
  if (event.source === "ethereum") {
    return {
      params: event.params,
      result: event.result,
      method: event.method,
    };
  }

  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  const search: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    search[k] = v;
  });
  return {
    request: tryParseJson(event.requestBody),
    response: tryParseJson(event.responseBody),
    url: { host: url.host, path: url.pathname, full: event.url, search },
    method: event.method,
  };
};
