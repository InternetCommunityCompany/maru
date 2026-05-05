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

    installInterceptors((rawEvent) => {
      const emit = (swap: Parameters<typeof channel.emit>[0]) => {
        // fire-and-forget — dapp must not block on extension round-trip
        void channel.emit(swap).catch(() => {});
      };

      const matched = matchTemplates(rawEvent, registry);
      if (matched.length > 0) {
        for (const swap of matched) emit(swap);
        return;
      }

      const fallback = heuristicMatch(rawEvent);
      if (fallback) emit(fallback);
    });
  },
});
