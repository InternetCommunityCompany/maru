import type { InterceptedEvent } from "@/interceptors/types";
import { buildEvalContext } from "./build-eval-context";
import { buildSwapEvent } from "./build-swap-event";
import { evaluate } from "./evaluate";
import { matchesDomain } from "./matches-domain";
import type { SwapEvent, Template } from "./types";

/**
 * Runs every template in `templates` against `event` and returns the
 * resulting `SwapEvent`s.
 *
 * Only `response`-phase fetch/XHR events with 2xx status are considered;
 * everything else returns an empty array. For each template, the engine
 * checks page domain → method → URL regex (cheap rejects) before parsing
 * any JSON. Templates with `iterate` fan out to one event per array
 * element; without `iterate`, at most one event per template.
 *
 * @param pageHost host for domain matching, defaults to `window.location.host`
 *                 — pass explicitly when testing outside a browser context.
 */
export function matchTemplates(
  event: InterceptedEvent,
  templates: Template[],
  pageHost: string = window.location.host,
): SwapEvent[] {
  if (event.source !== "fetch" && event.source !== "xhr") return [];
  if (event.phase !== "response") return [];
  if (event.status != null && (event.status < 200 || event.status >= 300)) {
    return [];
  }

  const out: SwapEvent[] = [];
  for (const tpl of templates) {
    const matchedDomain = matchesDomain(pageHost, tpl.match.domains);
    if (!matchedDomain) continue;
    if (tpl.match.method && tpl.match.method !== event.method) continue;
    let urlRe: RegExp;
    try {
      urlRe = new RegExp(tpl.match.urlPattern);
    } catch {
      continue;
    }
    if (!urlRe.test(event.url)) continue;

    const ctx = buildEvalContext(event);
    if (!ctx) continue;

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
