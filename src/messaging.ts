import {
  type Adapter,
  type Message,
  type OnMessage,
  type SendMessage,
  checkMessage,
  defineProxy,
} from "comctx";
import type { ParsedEvent } from "@/types";

const NAMESPACE = "__maru-event-channel__";

class EventChannel {
  constructor(private handler: (event: ParsedEvent) => void = () => {}) {}
  async emit(event: ParsedEvent): Promise<void> {
    this.handler(event);
  }
}

export const [provideEventChannel, injectEventChannel] = defineProxy(
  (handler: (event: ParsedEvent) => void = () => {}) =>
    new EventChannel(handler),
  { namespace: NAMESPACE, heartbeatCheck: false },
);

const isOurMessage = (data: unknown): data is Partial<Message> =>
  checkMessage(data as Partial<Message>) &&
  (data as Partial<Message>).namespace === NAMESPACE;

export class MainAdapter implements Adapter {
  sendMessage: SendMessage = (message) => {
    window.postMessage(message, window.location.origin);
  };
  onMessage: OnMessage = (callback) => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (!isOurMessage(event.data)) return;
      callback(event.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  };
}

type BackgroundMeta = { tabId?: number };

export class BackgroundAdapter implements Adapter<BackgroundMeta> {
  sendMessage: SendMessage<BackgroundMeta> = (message) => {
    const tabId = message.meta?.tabId;
    if (tabId == null) return;
    browser.tabs.sendMessage(tabId, message).catch(() => {
      // tab may have closed or navigated — drop silently
    });
  };
  onMessage: OnMessage<BackgroundMeta> = (callback) => {
    const handler = (
      rawMessage: unknown,
      sender: Browser.runtime.MessageSender,
    ) => {
      if (!isOurMessage(rawMessage)) return;
      const message = rawMessage as Message<BackgroundMeta>;
      callback({
        ...message,
        meta: { ...message.meta, tabId: sender.tab?.id },
      });
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  };
}

export function startContentRelay(): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!isOurMessage(event.data)) return;
    browser.runtime.sendMessage(event.data).catch(() => {
      // background may be unavailable — drop silently
    });
  });

  browser.runtime.onMessage.addListener((message) => {
    if (!isOurMessage(message)) return;
    window.postMessage(message, window.location.origin);
  });
}
