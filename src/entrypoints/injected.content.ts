import { createArbiter } from "@/arbiter/arbiter";
import { onTrace } from "@/debug/debug-bus";
import { createDomGrounding } from "@/dom-grounding";
import { resolveTokenMeta } from "@/dom-grounding/stub-token-meta";
import { installInterceptors } from "@/interceptors/install-interceptors";
import { heuristicMatch } from "@/heuristic/heuristic-match";
import { emitDebug } from "@/messaging/debug-channel";
import { emitQuote } from "@/messaging/quote-channel";
import { matchTemplates } from "@/template-engine/match-templates";
import { registry } from "@/templates/registry";

if (import.meta.env.DEV) {
  // Mirror MAIN-world traces onto the window envelope so the ISOLATED relay
  // can forward them to the background buffer. Vite DCE drops this block
  // (and the two imports above that only flow through it) in production.
  onTrace(emitDebug);
}

export default defineContentScript({
  matches: ["<all_urls>"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const arbiter = createArbiter({ emit: emitQuote });

    const wireGrounding = (): void => {
      const grounding = createDomGrounding({ resolveMeta: resolveTokenMeta });
      // `null` means no DOM (e.g. service worker context that mis-loaded
      // this entrypoint). The arbiter keeps emitting at the no-grounding
      // tier — silent failure isn't an option, see CONFIDENCE table.
      if (grounding) arbiter.setGroundingProvider(grounding.groundCandidates);
    };
    if (document.readyState === "loading") {
      // The observer needs `document.body` to attach. We run at
      // `document_start`, so wait until parsing has produced a body before
      // walking — the arbiter still emits at the no-grounding tier until
      // then.
      document.addEventListener("DOMContentLoaded", wireGrounding, {
        once: true,
      });
    } else {
      wireGrounding();
    }

    installInterceptors((rawEvent) => {
      const matched = matchTemplates(rawEvent, registry);
      if (matched.length > 0) {
        for (const swap of matched) arbiter.ingest(swap, rawEvent);
        return;
      }

      const fallback = heuristicMatch(rawEvent);
      if (fallback) arbiter.ingest(fallback, rawEvent);
    });
  },
});
