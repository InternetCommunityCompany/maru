import { startContentRelay } from "@/messaging/relay";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    startContentRelay();
  },
});
