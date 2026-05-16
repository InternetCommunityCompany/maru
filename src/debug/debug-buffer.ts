import type { DebugEvent } from "./debug-event";

const MAX_EVENTS_PER_TAB = 1000;

type Listener = (event: DebugEvent) => void;

const buffers = new Map<number, DebugEvent[]>();
const listenersByTab = new Map<number, Set<Listener>>();

/**
 * Background-side per-tab ring buffer for `DebugEvent`s. Caps each tab at
 * {@link MAX_EVENTS_PER_TAB} (FIFO drop). Subscribers receive only events
 * pushed *after* subscribing — no backfill — so the DevTools panel must open
 * before traces are interesting. A throwing subscriber is logged and skipped;
 * siblings still receive the event. `clear(tabId)` drops buffered events but
 * leaves listeners intact so a DevTools panel surviving a reset keeps streaming.
 */
export const debugBuffer = {
  push(tabId: number, event: DebugEvent): void {
    let buf = buffers.get(tabId);
    if (!buf) {
      buf = [];
      buffers.set(tabId, buf);
    }
    buf.push(event);
    if (buf.length > MAX_EVENTS_PER_TAB) buf.shift();

    const listeners = listenersByTab.get(tabId);
    if (!listeners) return;
    // Iterate a copy so a listener unsubscribing mid-fanout doesn't skip a sibling.
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (err) {
        console.warn("[maru] debugBuffer subscriber threw", err);
      }
    }
  },

  subscribe(tabId: number, listener: Listener): () => void {
    let set = listenersByTab.get(tabId);
    if (!set) {
      set = new Set();
      listenersByTab.set(tabId, set);
    }
    set.add(listener);
    return () => {
      const s = listenersByTab.get(tabId);
      if (!s) return;
      s.delete(listener);
      if (s.size === 0) listenersByTab.delete(tabId);
    };
  },

  clear(tabId: number): void {
    buffers.delete(tabId);
  },
};
