import { createArbiter } from "@/arbiter/arbiter";
import { installInterceptors } from "@/interceptors/install-interceptors";
import { heuristicMatch } from "@/heuristic/heuristic-match";
import { QUOTE_UPDATE_MESSAGE_TYPE } from "@/messaging/quote-update-message";
import { matchTemplates } from "@/template-engine/match-templates";
import { registry } from "@/templates/registry";

export default defineContentScript({
  matches: ["<all_urls>"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const arbiter = createArbiter({
      emit: (update) => {
        window.postMessage(
          { type: QUOTE_UPDATE_MESSAGE_TYPE, update },
          window.location.origin,
        );
      },
    });

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
