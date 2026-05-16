import type { InterceptedEvent } from "@/interceptors/install-interceptors";
import { tryParseJson } from "./try-parse-json";

/**
 * The data scope a template's path expressions evaluate against.
 *
 * Path expressions reference top-level keys via a `$source` prefix
 * (`$request`, `$response`, `$url`, `$method`, `$params`, `$result`,
 * `$item`). For HTTP events the engine binds `request`/`response`/`url`/
 * `method`; for ethereum events it binds `params`/`result`/`method`. Keys
 * not bound for the current source resolve to `undefined`.
 */
export type EvalContext = {
  /** HTTP request body, JSON-decoded. Bound for fetch/xhr events. */
  request?: unknown;
  /** HTTP response body, JSON-decoded. Bound for fetch/xhr events. */
  response?: unknown;
  /** URL components. Bound for fetch/xhr events. */
  url?: {
    host: string;
    path: string;
    /** Path split on `/` with empty parts removed: `/quote/v7/1` → `["quote", "v7", "1"]`. */
    segments: string[];
    full: string;
    search: Record<string, string>;
  };
  /** HTTP verb (fetch/xhr) or RPC method name (ethereum). */
  method?: string;
  /** RPC params (typically an array). Bound for ethereum events. */
  params?: unknown;
  /** RPC result. Bound for ethereum events. */
  result?: unknown;
  /** ABI-decoded function args, keyed by parameter name. Bound when an ethereum-source template specifies `match.abi` and decoding succeeds. */
  decoded?: Record<string, unknown>;
  /** Current iterated element. Bound only inside an `iterate` step. */
  item?: unknown;
};

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
  const segments = url.pathname.split("/").filter(Boolean);
  return {
    request: tryParseJson(event.requestBody),
    response: tryParseJson(event.responseBody),
    url: {
      host: url.host,
      path: url.pathname,
      segments,
      full: event.url,
      search,
    },
    method: event.method,
  };
};
