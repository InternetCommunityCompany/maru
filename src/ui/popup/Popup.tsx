import { useExcludedSites } from "@/storage/use-excluded-sites";
import { DEMO_LIFETIME } from "@/ui/demo-data";
import type { MaruState } from "@/ui/mascot/state-sources";
import { LifetimeSavings } from "./LifetimeSavings";
import { MasterToggle } from "./MasterToggle";
import { PopupFooter } from "./PopupFooter";
import { PopupHeader } from "./PopupHeader";
import { useActiveSite } from "./use-active-site";

/** Hostname shown when MARU is opened on a tab that has no addressable URL. */
const FALLBACK_SITE = "this site";

/**
 * The toolbar popup. Header + per-site toggle + lifetime savings + footer
 * link strip. Per-site enabled state is round-tripped through
 * {@link useExcludedSites} so the content script overlay stays in sync.
 *
 * @remarks
 * Settings/history are deeper than the popup is wide, so the footer links
 * open the dedicated options page in a new tab rather than swapping in
 * sub-views.
 *
 * The master toggle is held back from the first render until the storage
 * read resolves — otherwise the switch flashes on the wrong side for a
 * frame on every popup open.
 */
export function Popup() {
  const activeHost = useActiveSite();
  const site = activeHost ?? FALLBACK_SITE;
  const { sites: excluded, loaded, setEnabled } = useExcludedSites();

  const enabled = activeHost ? !excluded.includes(activeHost) : false;
  const mascot: MaruState = enabled ? "thumbs-up" : "yawning";

  const closePopup = () => window.close();

  const openPanel = (panel: "settings" | "history") => {
    void browser.tabs.create({
      url: browser.runtime.getURL("/options.html") + `#${panel}`,
    });
    closePopup();
  };

  return (
    <div className="popup">
      <PopupHeader
        mascot={mascot}
        onOpenSettings={() => openPanel("settings")}
        onClose={closePopup}
      />
      {loaded && (
        <MasterToggle
          site={site}
          enabled={enabled}
          onToggle={(next) => activeHost && setEnabled(activeHost, next)}
        />
      )}
      <LifetimeSavings
        total={DEMO_LIFETIME.total}
        swaps={DEMO_LIFETIME.swaps}
        streak={DEMO_LIFETIME.streak}
      />
      <PopupFooter
        onOpenHistory={() => openPanel("history")}
        onOpenSettings={() => openPanel("settings")}
        onOpenHelp={() => openPanel("settings")}
      />
    </div>
  );
}
