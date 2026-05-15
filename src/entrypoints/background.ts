import { createComparisonOrchestrator } from "@/comparison/comparison-orchestrator";
import { fetchBestQuote } from "@/comparison/fetch-best-quote";
import { injectComparisonChannel } from "@/messaging/comparison-channel";
import { PortAdapter } from "@/messaging/port-adapter";
import { provideQuoteChannel } from "@/messaging/quote-channel";
import { QUOTE_RELAY_PORT_NAME } from "@/messaging/relay";
import { createQuoteReducer } from "@/quote-reducer/quote-reducer";
import { ensureChainList } from "@/metadata/chain-info/ensure-chain-list";
import { ensureTokenList } from "@/metadata/token-info/ensure-token-list";

const COMPARISON_PORT_NAME = "maru:comparison";

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

  const reducer = createQuoteReducer();

  // Log only on actual map changes — out-of-order arrivals are dropped
  // silently inside the reducer, so the dev terminal shows one line per
  // visible state change instead of one per emission.
  reducer.subscribe((change) => {
    if (change.type === "evicted") {
      console.log(`[maru -] session ${change.sessionKey} evicted (idle)`);
      return;
    }
    const { swap } = change.update;
    const tag = change.type === "added" ? "+" : "~";
    console.log(
      `[maru ${tag}${swap.type}] ${swap.domain} via ${swap.provider ?? swap.templateId}: ` +
        `${swap.amountIn} ${swap.tokenIn} → ${swap.amountOut} ${swap.tokenOut} ` +
        `(seq ${change.update.sequence}, conf ${change.update.confidence.toFixed(2)})`,
      change.update,
    );
  });

  const orchestrator = createComparisonOrchestrator({
    reducer,
    fetchBestQuote,
  });

  // Per-tab port wiring. Each content script opens one of two named ports;
  // the connect handler attaches the appropriate channel(s) for that tab
  // and tears everything down when the port disconnects. No global
  // `browser.tabs.query`/`sendMessage` fanout — snapshots are point-cast.
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === QUOTE_RELAY_PORT_NAME) {
      const adapter = new PortAdapter(port);
      provideQuoteChannel(adapter, (update) => reducer.ingest(update));
      // Quote provider has no resources to release beyond the adapter's
      // `onMessage` listener, which dies with the port. Nothing else to do.
      return;
    }
    if (port.name === COMPARISON_PORT_NAME) {
      const adapter = new PortAdapter(port);
      const channel = injectComparisonChannel(adapter);
      const unsubscribe = orchestrator.subscribe((snapshot) => {
        void channel.emit(snapshot).catch(() => {
          // Heartbeat rejection or port death — `onDisconnect` will fire and
          // tear this listener down. Nothing actionable here.
        });
      });
      port.onDisconnect.addListener(() => unsubscribe());
      return;
    }
    // Unknown port name — close it so the caller doesn't believe it's wired.
    port.disconnect();
  });
});
