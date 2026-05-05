import type { InterceptedEvent } from "@/interceptors/types";

type Source = InterceptedEvent["source"];

/**
 * A dapp template definition: matching rules + extraction rules.
 *
 * The template engine evaluates `match` first as a fast reject (interceptor
 * source, page domain, event method, URL regex). Only matched events are run
 * through `extract`, which optionally iterates over an array (`iterate`) and
 * pulls scalar values out via path expressions (`fields`). See
 * `docs/templates.md` for the full schema reference.
 */
export type Template = {
  id: string;
  name: string;
  schema: "swap";
  match: {
    /** Restricts which interceptor source(s) this template applies to. Omit to match any source. */
    source?: Source | Source[];
    /** Page hosts. Matches the page host or any subdomain of one. Omit to match any host (useful for templates keyed on a contract address rather than a specific dapp). */
    domains?: string[];
    /** Matches `event.method` (HTTP verb for fetch/xhr, RPC method name for ethereum). */
    method?: string | string[];
    /** URL regex; only meaningful for fetch/xhr. Ignored for ethereum events. */
    urlPattern?: string;
    /** Transaction recipient filter; only meaningful for ethereum events with `params[0].to`. Case-insensitive. */
    to?: string | string[];
    /** Human-readable function signatures to decode `params[0].data` against. Only meaningful for ethereum events. */
    abi?: string[];
  };
  extract: {
    iterate?: string;
    /** Literal field values applied before path-expression `fields`. Use for values that can't come from the wire (chain ids, provider name for native protocols). */
    static?: Record<string, unknown>;
    fields: Record<string, string>;
  };
};

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
 * A normalized swap or bridge quote extracted by a template.
 *
 * `type` is `"bridge"` if `chainIn !== chainOut`, otherwise `"swap"`. The
 * required fields (`chainIn`, `chainOut`, `tokenIn`, `tokenOut`, `amountIn`,
 * `amountOut`) are the minimum to express a rate — if any can't be resolved,
 * the engine drops the event rather than emitting a partial. Token symbols,
 * decimals, USD values, and gas costs are intentionally absent: consumers
 * resolve them from on-chain data or oracles.
 *
 * `transport` discriminates on the originating interceptor: HTTP carries the
 * URL, ethereum carries the wallet's announced provider info (when present).
 */
export type SwapEvent = {
  kind: "swap";
  type: "swap" | "bridge";
  templateId: string;
  domain: string;
  chainIn: number;
  chainOut: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountOutMin?: string;
  fromAddress?: string;
  toAddress?: string;
  provider?: string;
  transport:
    | { source: "fetch" | "xhr"; url: string; method: string }
    | {
        source: "ethereum";
        method: string;
        providerInfo?: { uuid?: string; name?: string; rdns?: string };
      };
};
