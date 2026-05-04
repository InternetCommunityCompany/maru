import { installInterceptors } from "@/interceptors";
import { MainAdapter, injectEventChannel } from "@/messaging";
import { parse } from "@/parser";

export default defineContentScript({
  matches: ["<all_urls>"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const channel = injectEventChannel(new MainAdapter());

    installInterceptors((rawEvent) => {
      for (const parsed of parse(rawEvent)) {
        // fire-and-forget — dapp must not block on extension round-trip
        void channel.emit(parsed).catch(() => {});
      }
    });
  },
});
