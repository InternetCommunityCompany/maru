import tokensCss from "@/assets/styles/tokens.css?inline";
import overlayCss from "@/assets/styles/overlay.css?inline";

import React from "react";
import ReactDOM from "react-dom/client";
import { installFonts } from "@/assets/install-fonts";
import { provideComparisonChannel } from "@/messaging/comparison-channel";
import { connectWithReconnect } from "@/messaging/connect-with-reconnect";
import { PortAdapter } from "@/messaging/port-adapter";
import { ensureChainList } from "@/metadata/chain-info/ensure-chain-list";
import { ensureTokenList } from "@/metadata/token-info/ensure-token-list";
import { canonicaliseHost } from "@/storage/canonicalise-host";
import { excludedSites } from "@/storage/excluded-sites";
import { Overlay } from "@/ui/overlay/Overlay";
import { createSnapshotStore } from "@/ui/overlay/snapshot-store";

/**
 * Wire namespace of the port the overlay content script opens to the
 * background. The background's `runtime.onConnect` listener matches on this
 * name to wire `ComparisonChannel` for this tab — snapshots flow background→
 * overlay over this single port.
 */
const COMPARISON_PORT_NAME = "maru:comparison";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  // We pull the CSS in via `?inline` (string constants) and inject it
  // ourselves inside the shadow root — no auto-injection wanted.
  cssInjectionMode: "manual",
  async main(ctx) {
    if (await isHostExcluded()) return;

    installFonts();

    // Hydrate the content-script's own copy of the metadata indices.
    // Each JS context (background SW, content script) holds its own
    // module-singleton — the background's hydration doesn't reach us here.
    // Both calls are idempotent and read from `storage.local` first; the
    // network fetch only fires if the cache is past its TTL.
    void ensureTokenList();
    void ensureChainList();

    const store = createSnapshotStore();

    // Plain `host > shadow > [style, mount]` — no fake <html>/<body> wrappers.
    // Lets `.overlay`'s `position: fixed` and `z-index` work against the page
    // without an extra positioning ancestor caught in the page's transforms.
    const host = document.createElement("maru-overlay");
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `${tokensCss}\n${overlayCss}`;
    shadow.appendChild(style);
    const mount = document.createElement("div");
    shadow.appendChild(mount);
    document.body.appendChild(host);

    const root = ReactDOM.createRoot(mount);
    root.render(
      <React.StrictMode>
        <Overlay store={store} />
      </React.StrictMode>,
    );

    // Open a long-lived port to the background and (re-)wire the comparison
    // channel provider against each fresh port. Snapshots emitted by the
    // background orchestrator flow into the overlay's snapshot store, which
    // `<Overlay>` reads via `useSyncExternalStore`.
    const reconnector = connectWithReconnect(COMPARISON_PORT_NAME, (port) => {
      const adapter = new PortAdapter(port);
      provideComparisonChannel(adapter, (snapshot) => {
        store.set(snapshot);
      });
    });

    const remove = () => {
      reconnector.close();
      root.unmount();
      host.remove();
    };
    ctx.onInvalidated(remove);

    const hostName = canonicaliseHost(location.hostname);
    const unwatch = excludedSites.watch((next) => {
      if (next.includes(hostName)) remove();
    });
    ctx.onInvalidated(unwatch);
  },
});

async function isHostExcluded(): Promise<boolean> {
  const list = await excludedSites.getValue();
  return list.includes(canonicaliseHost(location.hostname));
}
