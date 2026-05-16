import type { SessionKey } from "@/arbiter/types";
import { createComparisonOrchestrator } from "@/comparison/comparison-orchestrator";
import { fetchBestQuote } from "@/comparison/fetch-best-quote";
import { debugBuffer } from "@/debug/debug-buffer";
import {
  COMPARISON_PORT_NAME,
  emitComparison,
} from "@/messaging/comparison-channel";
import { DEBUG_PORT_NAME, onDebug } from "@/messaging/debug-channel";
import {
  DEBUG_PANEL_PORT_NAME,
  emitDebugToPanel,
  isDebugPanelHandshake,
} from "@/messaging/debug-panel-channel";
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

  // DEV-only: maps `sessionKey` to the originating tab so the orchestrator-tee
  // below can route `compare_snapshot` events back to the right per-tab buffer.
  // Populated inside the `QUOTE_PORT_NAME` branch — see the onConnect handler.
  const sessionKeyToTabId = import.meta.env.DEV
    ? new Map<SessionKey, number>()
    : null;

  if (import.meta.env.DEV) {
    orchestrator.subscribe((snapshot) => {
      const { swap } = snapshot.update;
      console.log(`[maru ${swap.domain}] ${snapshot.status} seq=${snapshot.update.sequence}`);
    });

    // Tee orchestrator output into the per-tab debug buffer. The map above is
    // populated on every `onQuote` ingest, so by the time a snapshot fires the
    // tabId is already known. A snapshot without a known tabId (e.g. arrived
    // after a tab close that evicted the entry) is silently dropped.
    orchestrator.subscribe((snapshot) => {
      const tabId = sessionKeyToTabId?.get(snapshot.update.sessionKey);
      if (tabId === undefined) return;
      debugBuffer.push(tabId, {
        kind: "compare_snapshot",
        at: Date.now(),
        snapshot,
      });
    });
  }

  // Per-tab port wiring. Each content script opens one of two named ports;
  // the connect handler attaches the appropriate channel(s) for that tab
  // and tears everything down when the port disconnects. No global
  // `browser.tabs.query`/`sendMessage` fanout — snapshots are point-cast.
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === QUOTE_PORT_NAME) {
      onQuote(port, (update) => {
        if (import.meta.env.DEV && port.sender?.tab?.id !== undefined) {
          sessionKeyToTabId?.set(update.sessionKey, port.sender.tab.id);
        }
        orchestrator.ingest(update);
      });
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
    if (import.meta.env.DEV) {
      if (port.name === DEBUG_PORT_NAME) {
        const tabId = port.sender?.tab?.id;
        if (tabId === undefined) {
          port.disconnect();
          return;
        }
        onDebug(port, (event) => debugBuffer.push(tabId, event));
        return;
      }
      if (port.name === DEBUG_PANEL_PORT_NAME) {
        // Panel sends a `{ tabId }` handshake once. We subscribe on the first
        // valid handshake and ignore subsequent messages — the port is one-way
        // after that.
        let unsubscribe: (() => void) | null = null;
        port.onMessage.addListener((raw: unknown) => {
          if (unsubscribe !== null) return;
          if (!isDebugPanelHandshake(raw)) return;
          unsubscribe = debugBuffer.subscribe(raw.tabId, (event) =>
            emitDebugToPanel(port, event),
          );
        });
        port.onDisconnect.addListener(() => unsubscribe?.());
        return;
      }
    }
    // Unknown port name — close it so the caller doesn't believe it's wired.
    port.disconnect();
  });
});
