import tokensCss from "@/assets/styles/tokens.css?inline";
import overlayCss from "@/assets/styles/overlay.css?inline";

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  createAlertFeedSubscribeMessage,
  createAlertFeedUnsubscribeMessage,
  isAlertFeedChangeMessage,
  isAlertFeedSubscribeResponse,
  type AlertViewModel,
} from "@/alert-feed/types";
import { installFonts } from "@/assets/install-fonts";
import { canonicaliseHost } from "@/storage/canonicalise-host";
import { excludedSites } from "@/storage/excluded-sites";
import { Overlay } from "@/ui/overlay/Overlay";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  // We pull the CSS in via `?inline` (string constants) and inject it
  // ourselves inside the shadow root — no auto-injection wanted.
  cssInjectionMode: "manual",
  async main(ctx) {
    if (await isHostExcluded()) return;

    installFonts();

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
        <LiveOverlay />
      </React.StrictMode>,
    );

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
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

function LiveOverlay() {
  const [alert, setAlert] = useState<AlertViewModel | null>(null);

  useEffect(() => {
    const subscriptionId = createSubscriptionId();
    let cancelled = false;

    const onMessage = (message: unknown) => {
      if (!isAlertFeedChangeMessage(message)) return;
      if (message.subscriptionId !== subscriptionId) return;
      setAlert(message.change.view);
    };

    browser.runtime.onMessage.addListener(onMessage);
    browser.runtime
      .sendMessage(createAlertFeedSubscribeMessage(subscriptionId))
      .then((response) => {
        if (cancelled || !isAlertFeedSubscribeResponse(response)) return;
        setAlert(response.view);
      })
      .catch(() => {
        if (!cancelled) setAlert(null);
      });

    return () => {
      cancelled = true;
      browser.runtime.onMessage.removeListener(onMessage);
      browser.runtime
        .sendMessage(createAlertFeedUnsubscribeMessage(subscriptionId))
        .catch(() => {});
    };
  }, []);

  return <Overlay alert={alert} />;
}

function createSubscriptionId(): string {
  if ("randomUUID" in crypto) return crypto.randomUUID();
  return `overlay-${Date.now()}-${Math.random()}`;
}
