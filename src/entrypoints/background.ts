import { createComparisonOrchestrator } from "@/comparison/comparison-orchestrator";
import { fetchBestQuote } from "@/comparison/fetch-best-quote";
import {
  COMPARISON_PORT_NAME,
  emitComparison,
} from "@/messaging/comparison-channel";
import { QUOTE_PORT_NAME, onQuote } from "@/messaging/quote-channel";
import { ensureChainList } from "@/metadata/chain-info/ensure-chain-list";
import { ensureTokenList } from "@/metadata/token-info/ensure-token-list";

export default defineBackground(() => {
  // Boot-time refresh of the metadata caches — each hydrates its in-memory
  // index from `storage.local`, and re-fetches against the backend if the
  // cache is past its TTL. Errors are swallowed inside each helper (the
  // existing cache, if any, still hydrates), so these are safe to
  // fire-and-forget.
  void ensureTokenList();
  void ensureChainList();
  browser.runtime.onInstalled.addListener(() => {
    void ensureTokenList();
    void ensureChainList();
  });

  const orchestrator = createComparisonOrchestrator({ fetchBestQuote });

  if (import.meta.env.DEV) {
    orchestrator.subscribe((snapshot) => {
      const { swap } = snapshot.update;
      console.log(`[maru ${swap.domain}] ${snapshot.status} seq=${snapshot.update.sequence}`);
    });
  }

  // Per-tab port wiring. Each content script opens one of two named ports;
  // the connect handler attaches the appropriate channel(s) for that tab
  // and tears everything down when the port disconnects. No global
  // `browser.tabs.query`/`sendMessage` fanout — snapshots are point-cast.
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === QUOTE_PORT_NAME) {
      onQuote(port, (update) => orchestrator.ingest(update));
      // The listener dies with the port; nothing else to release.
      return;
    }
    if (port.name === COMPARISON_PORT_NAME) {
      const unsubscribe = orchestrator.subscribe((snapshot) => {
        emitComparison(port, snapshot);
      });
      port.onDisconnect.addListener(() => unsubscribe());
      return;
    }
    // Unknown port name — close it so the caller doesn't believe it's wired.
    port.disconnect();
  });
});
