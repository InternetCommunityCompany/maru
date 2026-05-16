import type { DebugEvent } from "@/debug/debug-event";

export const DEBUG_PANEL_PORT_NAME = "maru:debug-panel";

/**
 * First message the panel sends after `runtime.connect(DEBUG_PANEL_PORT_NAME)`.
 * The background uses `tabId` to attach a `debugBuffer.subscribe(tabId, ...)`
 * for the lifetime of the port.
 */
export type DebugPanelHandshake = { tabId: number };

export const isDebugPanelHandshake = (data: unknown): data is DebugPanelHandshake =>
  typeof data === "object" &&
  data !== null &&
  typeof (data as { tabId?: unknown }).tabId === "number";

/**
 * Push a `DebugEvent` to an open panel. A throw here usually means the port
 * dropped between the last `onDisconnect` check and this call — `onDisconnect`
 * will tear the subscription down. Log so non-port errors aren't invisible.
 */
export const emitDebugToPanel = (
  port: Browser.runtime.Port,
  event: DebugEvent,
): void => {
  try {
    port.postMessage(event);
  } catch (err) {
    console.warn("[maru] emitDebugToPanel failed", err);
  }
};

/** Panel-side handler. Port is private to the extension, so the cast is sound. */
export const onDebugFromBackground = (
  port: Browser.runtime.Port,
  handler: (event: DebugEvent) => void,
): void => {
  port.onMessage.addListener((raw: unknown) => {
    handler(raw as DebugEvent);
  });
};
