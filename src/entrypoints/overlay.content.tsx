import "@/assets/styles/tokens.css";
import "@/assets/styles/overlay.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { installWordmarkFont } from "@/assets/install-wordmark-font";
import { excludedSites } from "@/storage/excluded-sites";
import { Overlay } from "@/ui/overlay/Overlay";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  async main(ctx) {
    if (await isHostExcluded()) return;

    installWordmarkFont();

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

    const unwatch = excludedSites.watch((next) => {
      if (next.includes(location.hostname)) ui.remove();
    });
    ctx.onInvalidated(unwatch);
  },
});

async function isHostExcluded(): Promise<boolean> {
  const list = await excludedSites.getValue();
  return list.includes(location.hostname);
}
