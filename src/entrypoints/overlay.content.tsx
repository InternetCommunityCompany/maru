import tokensCss from "@/assets/styles/tokens.css?inline";
import overlayCss from "@/assets/styles/overlay.css?inline";

import React from "react";
import ReactDOM from "react-dom/client";
import { installFonts } from "@/assets/install-fonts";
import { ContentAdapter } from "@/messaging/content-adapter";
import { provideComparisonChannel } from "@/messaging/comparison-channel";
import { ensureChainList } from "@/metadata/chain-info/ensure-chain-list";
import { ensureTokenList } from "@/metadata/token-info/ensure-token-list";
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

    // Hydrate the content-script's own copy of the metadata indices.
    // Each JS context (background SW, content script) holds its own
    // module-singleton — the background's hydration doesn't reach us here.
    // Both calls are idempotent and read from `storage.local` first; the
    // network fetch only fires if the cache is past its TTL.
    void ensureTokenList();
    void ensureChainList();

    const store = createSnapshotStore();
    provideComparisonChannel(new ContentAdapter(), (snapshot) => {
      store.set(snapshot);
    });

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

    const remove = () => {
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
