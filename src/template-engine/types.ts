/**
 * A dapp template definition: matching rules + extraction rules.
 *
 * The template engine evaluates `match` first as a fast reject (page domain,
 * HTTP method, URL regex). Only matched events are run through `extract`,
 * which optionally iterates over an array (`iterate`) and pulls scalar
 * values out via path expressions (`fields`). See `docs/templates.md` for
 * the full schema reference.
 */
export type Template = {
  id: string;
  name: string;
  schema: "swap";
  match: {
    domains: string[];
    method?: string;
    urlPattern: string;
  };
  extract: {
    iterate?: string;
    fields: Record<string, string>;
  };
};

/**
 * The data scope a template's path expressions evaluate against.
 *
 * Each top-level key is reachable via the matching `$source` prefix in path
 * expressions (`$request`, `$response`, `$url`, `$method`, `$item`).
 * `request`/`response` are the JSON-decoded bodies (or `undefined` if not
 * JSON). `item` is only set inside an iteration step.
 */
export type EvalContext = {
  request?: unknown;
  response?: unknown;
  url?: {
    host: string;
    path: string;
    full: string;
    search: Record<string, string>;
  };
  method?: string;
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
  transport: { url: string; method: string; source: "fetch" | "xhr" };
};
