import tokensCss from "@/assets/styles/tokens.css?inline";
import overlayCss from "@/assets/styles/overlay.css?inline";

import React from "react";
import ReactDOM from "react-dom/client";
import { installFonts } from "@/assets/install-fonts";
import {
  COMPARISON_PORT_NAME,
  onComparison,
} from "@/messaging/comparison-channel";
import { connectWithReconnect } from "@/messaging/connect-with-reconnect";
import { hydrateChainListFromStorage } from "@/metadata/chain-info/hydrate-from-storage";
import { hydrateTokenListFromStorage } from "@/metadata/token-info/hydrate-from-storage";
import { canonicaliseHost } from "@/storage/canonicalise-host";
import { excludedSites } from "@/storage/excluded-sites";
import { Overlay } from "@/ui/overlay/Overlay";
import { createSnapshotStore } from "@/ui/overlay/snapshot-store";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  // We pull the CSS in via `?inline` (string constants) and inject it
  // ourselves inside the shadow root — no auto-injection wanted.
  cssInjectionMode: "manual",
  async main(ctx) {
    if (await isHostExcluded()) return;

    installFonts();

    // Hydrate the content-script's own copy of the metadata indices from
    // `storage.local` and subscribe to future updates. The background SW
    // owns the network-refresh path (`ensureTokenList`/`ensureChainList`)
    // and writes through to storage; the watchers set up here propagate
    // those writes into our in-memory index.
    void hydrateTokenListFromStorage();
    void hydrateChainListFromStorage();

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
    // listener on each fresh port. Snapshots emitted by the orchestrator
    // flow into the overlay's snapshot store, which `<Overlay>` reads via
    // `useSyncExternalStore`.
    const reconnector = connectWithReconnect(COMPARISON_PORT_NAME, (port) => {
      onComparison(port, (snapshot) => store.set(snapshot));
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
