import { createArbiter } from "@/arbiter/arbiter";
import { createDomGrounding } from "@/dom-grounding";
import { resolveTokenMeta } from "@/dom-grounding/stub-token-meta";
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
