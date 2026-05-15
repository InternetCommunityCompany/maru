import type { InterceptedEvent } from "@/interceptors/install-interceptors";
import { normalizeTokenAddress } from "@/template-engine/normalize-token-address";
import type { SwapEvent } from "@/template-engine/build-swap-event";
import { tryParseJson } from "@/template-engine/try-parse-json";
import { findByAliases } from "./find-by-aliases";
import { HEURISTIC_ALIASES } from "./heuristic-aliases";
import { NESTING_PREFIXES } from "./nesting-prefixes";
import { parseUrlParams } from "./parse-url-params";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const AMOUNT_RE = /^\d+$/;

const asAddress = (v: unknown): string | null =>
  typeof v === "string" && ADDRESS_RE.test(v) ? v : null;

const asAmount = (v: unknown): string | null => {
  const s = typeof v === "number" ? String(v) : v;
  return typeof s === "string" && AMOUNT_RE.test(s) && s !== "0" ? s : null;
};

const asChainId = (v: unknown): number | null => {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Fallback matcher for fetch/XHR events the template registry didn't catch.
 *
 * Walks a curated list of field-name aliases against the parsed request and
 * response bodies plus the request URL's query parameters, validates each
 * candidate against a per-field shape check (address regex, non-zero digit
 * string, positive integer), and emits a `SwapEvent` only when **all**
 * required fields resolve. Returns `null` otherwise — and dropping is the
 * common case. Bodies are checked before query parameters, so an explicit
 * body value always wins over a URL one.
 *
 * Strict gates:
 * - Source must be `fetch` or `xhr` (ethereum is template-only, decoding
 *   bytes blindly is too risky).
 * - Status must be 2xx.
 * - All required fields must resolve and validate. The per-field shape
 *   checks (two distinct 0x-hex addresses, two non-zero digit amounts, a
 *   positive-integer chain id) are restrictive enough that the HTTP verb
 *   doesn't need to be — most non-swap endpoints can't satisfy all six.
 *
 * The emitted event uses `templateId: "heuristic"` so the source is
 * distinguishable from curated templates in logs / UIs. `provider` is left
 * unset — heuristic matches don't have a stable provider name.
 */
export function heuristicMatch(
  event: InterceptedEvent,
  pageHost: string = window.location.host,
): SwapEvent | null {
  if (event.source !== "fetch" && event.source !== "xhr") return null;
  if (event.phase !== "response") return null;
  if (event.status != null && (event.status < 200 || event.status >= 300)) {
    return null;
  }

  const req = tryParseJson(event.requestBody);
  const res = tryParseJson(event.responseBody);
  const params = parseUrlParams(event.url);
  const hasParams = Object.keys(params).length > 0;
  if (req === undefined && res === undefined && !hasParams) return null;

  const findIn = <T>(
    aliases: readonly string[],
    validate: (v: unknown) => T | null,
  ): T | null =>
    findByAliases(req, aliases, validate, NESTING_PREFIXES) ??
    findByAliases(res, aliases, validate, NESTING_PREFIXES) ??
    findByAliases(params, aliases, validate);

  const tokenIn = findIn(HEURISTIC_ALIASES.tokenIn, normalizeTokenAddress);
  const tokenOut = findIn(HEURISTIC_ALIASES.tokenOut, normalizeTokenAddress);
  const amountIn = findIn(HEURISTIC_ALIASES.amountIn, asAmount);
  const amountOut = findIn(HEURISTIC_ALIASES.amountOut, asAmount);

  let chainIn = findIn(HEURISTIC_ALIASES.chainIn, asChainId);
  let chainOut = findIn(HEURISTIC_ALIASES.chainOut, asChainId);
  // Same-chain default: a single `chainId` field maps to both ends.
  if (chainIn !== null && chainOut === null) chainOut = chainIn;
  if (chainOut !== null && chainIn === null) chainIn = chainOut;

  if (
    tokenIn === null ||
    tokenOut === null ||
    amountIn === null ||
    amountOut === null ||
    chainIn === null ||
    chainOut === null
  ) {
    return null;
  }

  const fromAddress =
    findIn(HEURISTIC_ALIASES.fromAddress, asAddress) ?? undefined;

  return {
    kind: "swap",
    type: chainIn === chainOut ? "swap" : "bridge",
    templateId: "heuristic",
    domain: pageHost,
    chainIn,
    chainOut,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    fromAddress,
    transport: {
      source: event.source,
      url: event.url,
      method: event.method,
    },
  };
}
