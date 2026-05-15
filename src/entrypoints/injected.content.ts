import { createArbiter } from "@/arbiter/arbiter";
import { installInterceptors } from "@/interceptors/install-interceptors";
import { heuristicMatch } from "@/heuristic/heuristic-match";
import { injectEventChannel } from "@/messaging/channel";
import { MainAdapter } from "@/messaging/main-adapter";
import { matchTemplates } from "@/template-engine/match-templates";
import { registry } from "@/templates/registry";

export default defineContentScript({
  matches: ["<all_urls>"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const channel = injectEventChannel(new MainAdapter());

    const arbiter = createArbiter({
      emit: (update) => {
        // fire-and-forget — dapp must not block on the extension round-trip.
        void channel.emit(update).catch(() => {});
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
