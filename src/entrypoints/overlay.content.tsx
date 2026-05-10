import "@/assets/styles/tokens.css";
import "@/assets/styles/overlay.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { installFonts } from "@/assets/install-fonts";
import { canonicaliseHost } from "@/storage/canonicalise-host";
import { excludedSites } from "@/storage/excluded-sites";
import { Overlay } from "@/ui/overlay/Overlay";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  async main(ctx) {
    if (await isHostExcluded()) return;

    installFonts();

    const ui = await createShadowRootUi(ctx, {
      name: "maru-overlay",
      position: "inline",
      anchor: "body",
      append: "last",
      isolateEvents: true,
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(
          <React.StrictMode>
            <Overlay />
          </React.StrictMode>,
        );
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });

    ui.mount();

    const host = canonicaliseHost(location.hostname);
    const unwatch = excludedSites.watch((next) => {
      if (next.includes(host)) ui.remove();
    });
    ctx.onInvalidated(unwatch);
  },
});

async function isHostExcluded(): Promise<boolean> {
  const list = await excludedSites.getValue();
  return list.includes(canonicaliseHost(location.hostname));
}
