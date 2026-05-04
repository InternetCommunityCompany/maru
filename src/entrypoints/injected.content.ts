import { installInterceptors } from "@/interceptors/install-interceptors";
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
      for (const swap of matchTemplates(rawEvent, registry)) {
        // fire-and-forget — dapp must not block on extension round-trip
        void channel.emit(swap).catch(() => {});
      }
    });
  },
});
