import { startContentRelay } from "@/messaging";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    startContentRelay();
  },
});
