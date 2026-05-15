import {
  type ComparisonOrchestrator,
  createComparisonOrchestrator,
} from "@/comparison/comparison-orchestrator";
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

  if (import.meta.env.DEV) wireDevLogging(orchestrator);

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

// Dev terminal log: one line per visible session change. `+` on first-seen
// sessionKey, `~` on subsequent. Out-of-order arrivals are dropped inside
// the orchestrator so they never reach this listener.
function wireDevLogging(orchestrator: ComparisonOrchestrator): void {
  const seen = new Set<string>();
  orchestrator.subscribe((snapshot) => {
    const { update } = snapshot;
    const tag = seen.has(update.sessionKey) ? "~" : "+";
    seen.add(update.sessionKey);
    const { swap } = update;
    console.log(
      `[maru ${tag}${swap.type}] ${swap.domain} via ${swap.provider ?? swap.templateId}: ` +
        `${swap.amountIn} ${swap.tokenIn} → ${swap.amountOut} ${swap.tokenOut} ` +
        `(seq ${update.sequence}, status ${snapshot.status}, conf ${update.confidence.toFixed(2)})`,
    );
  });
}
