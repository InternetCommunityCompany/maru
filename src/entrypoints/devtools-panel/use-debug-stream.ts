import { useEffect, useState } from "react";
import type { DebugEvent } from "@/debug/debug-event";
import { connectWithReconnect } from "@/messaging/connect-with-reconnect";
import {
  DEBUG_PANEL_PORT_NAME,
  onDebugFromBackground,
  type DebugPanelHandshake,
} from "@/messaging/debug-panel-channel";

export type DebugStream = {
  events: DebugEvent[];
};

/**
 * Subscribe to the dev `maru:debug-panel` port for the tab currently
 * inspected by this DevTools window. The panel performs a one-shot handshake
 * with `browser.devtools.inspectedWindow.tabId` on each (re)connect so the
 * background can attach the right per-tab buffer.
 *
 * @returns An in-memory event log — empty until events start arriving. No
 * backfill; events from before the panel opened are lost (matches the
 * extension's "open DevTools first" workflow).
 */
export function useDebugStream(): DebugStream {
  const [events, setEvents] = useState<DebugEvent[]>([]);

  useEffect(() => {
    const tabId = browser.devtools.inspectedWindow.tabId;
    const reconnector = connectWithReconnect(DEBUG_PANEL_PORT_NAME, (port) => {
      const handshake: DebugPanelHandshake = { tabId };
      port.postMessage(handshake);
      onDebugFromBackground(port, (event) => {
        setEvents((prev) => [...prev, event]);
      });
    });
    return () => reconnector.close();
  }, []);

  return { events };
}
