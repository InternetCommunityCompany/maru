import type { InterceptedEvent } from "@/interceptors/types";
import { buildEvalContext } from "./build-eval-context";
import { buildSwapEvent } from "./build-swap-event";
import { decodeCalldata } from "./decode-calldata";
import { evaluate } from "./evaluate";
import { matchesDomain } from "./matches-domain";
import type { EvalContext, SwapEvent, Template } from "./types";

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
