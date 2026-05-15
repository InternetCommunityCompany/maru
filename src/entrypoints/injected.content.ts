import { createArbiter } from "@/arbiter/arbiter";
import { installInterceptors } from "@/interceptors/install-interceptors";
import { heuristicMatch } from "@/heuristic/heuristic-match";
import { postQuoteUpdate } from "@/messaging/quote-update-message";
import { matchTemplates } from "@/template-engine/match-templates";
import { registry } from "@/templates/registry";

export default defineContentScript({
  matches: ["<all_urls>"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const arbiter = createArbiter({
      emit: (update) => {
        postQuoteUpdate(update);
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
