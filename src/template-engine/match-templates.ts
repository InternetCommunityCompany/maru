import type { InterceptedEvent } from "@/interceptors/install-interceptors";
import { buildEvalContext, type EvalContext } from "./build-eval-context";
import { buildSwapEvent, type SwapEvent } from "./build-swap-event";
import { decodeCalldata } from "./decode-calldata";
import { evaluate } from "./evaluate";
import { matchesDomain } from "./matches-domain";

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

const asArray = <T>(value: T | T[] | undefined): T[] | null =>
  value == null ? null : Array.isArray(value) ? value : [value];

const matchesAddress = (
  candidate: string | undefined,
  filter: string | string[],
): boolean => {
  if (!candidate) return false;
  const target = candidate.toLowerCase();
  const list = Array.isArray(filter) ? filter : [filter];
  return list.some((f) => f.toLowerCase() === target);
};

type EthereumTxParam = { to?: string; data?: string; from?: string };

const firstParam = (params: unknown): EthereumTxParam | undefined => {
  if (!Array.isArray(params)) return undefined;
  const p = params[0];
  return typeof p === "object" && p !== null ? (p as EthereumTxParam) : undefined;
};

/**
 * Runs every template in `templates` against `event` and returns the
 * resulting `SwapEvent`s.
 *
 * Only `response`-phase events are considered (the request phase doesn't yet
 * have a result, the error phase has nothing to extract). For HTTP events,
 * non-2xx responses are also rejected. Per-template checks run cheap-first:
 * source → page domain → event method → URL regex (HTTP) → recipient
 * address (ethereum) → ABI decode (ethereum). Templates with `iterate` fan
 * out to one event per array element; without `iterate`, at most one event
 * per template.
 *
 * @param pageHost host for domain matching, defaults to `window.location.host`
 *                 — pass explicitly when testing outside a browser context.
 */
export function matchTemplates(
  event: InterceptedEvent,
  templates: Template[],
  pageHost: string = window.location.host,
): SwapEvent[] {
  if (event.phase !== "response") return [];
  if (
    (event.source === "fetch" || event.source === "xhr") &&
    event.status != null &&
    (event.status < 200 || event.status >= 300)
  ) {
    return [];
  }

  const out: SwapEvent[] = [];
  for (const tpl of templates) {
    const sources = asArray(tpl.match.source);
    if (sources && !sources.includes(event.source)) continue;

    const matchedDomain = matchesDomain(pageHost, tpl.match.domains);
    if (!matchedDomain) continue;

    const methods = asArray(tpl.match.method);
    if (methods && !methods.includes(event.method)) continue;

    if (event.source !== "ethereum" && tpl.match.urlPattern) {
      let urlRe: RegExp;
      try {
        urlRe = new RegExp(tpl.match.urlPattern);
      } catch {
        continue;
      }
      if (!urlRe.test(event.url)) continue;
    }

    const baseCtx = buildEvalContext(event);
    if (!baseCtx) continue;

    let ctx: EvalContext = baseCtx;

    if (event.source === "ethereum") {
      const tx = firstParam(event.params);
      if (tpl.match.to && !matchesAddress(tx?.to, tpl.match.to)) continue;
      if (tpl.match.abi) {
        const decoded = tx?.data
          ? decodeCalldata(tpl.match.abi, tx.data)
          : null;
        if (!decoded) continue;
        ctx = { ...ctx, decoded: decoded.args };
      }
    }

    if (tpl.extract.iterate) {
      const items = evaluate(tpl.extract.iterate, ctx);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const swap = buildSwapEvent(tpl, matchedDomain, event, {
          ...ctx,
          item,
        });
        if (swap) out.push(swap);
      }
    } else {
      const swap = buildSwapEvent(tpl, matchedDomain, event, ctx);
      if (swap) out.push(swap);
    }
  }
  return out;
}
