import type { InterceptedEvent } from "@/interceptors/types";
import { tryParseJson } from "./try-parse-json";
import type { EvalContext } from "./types";

/**
 * Builds the data scope for a template against an HTTP-source event.
 *
 * Decodes both bodies as JSON (silently dropping non-JSON), exposes URL
 * components (`host`, `path`, `full`, `search`), and the HTTP method.
 * Returns `null` if the URL is malformed (which kills template matching for
 * this event).
 */
export const buildEvalContext = (
  event: Extract<InterceptedEvent, { source: "fetch" | "xhr" }>,
): EvalContext | null => {
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
