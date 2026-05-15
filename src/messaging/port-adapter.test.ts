import { describe, expect, it, vi } from "vitest";
import { MESSAGE_SENDER, MESSAGE_TYPE, type Message } from "comctx";
import { PortAdapter } from "./port-adapter";
import {
  COMPARISON_CHANNEL_NAMESPACE,
  QUOTE_CHANNEL_NAMESPACE,
} from "./namespace";

type MessageListener = (raw: unknown) => void;

const fakePort = () => {
  const messageListeners = new Set<MessageListener>();
  const postMessage = vi.fn<(msg: unknown) => void>();
  const port = {
    name: "test",
    postMessage,
    disconnect: vi.fn<() => void>(),
    onMessage: {
      addListener: (l: MessageListener) => messageListeners.add(l),
      removeListener: (l: MessageListener) => messageListeners.delete(l),
      hasListener: (l: MessageListener) => messageListeners.has(l),
    },
    onDisconnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    sender: undefined,
  } as unknown as Browser.runtime.Port;
  return {
    port,
    messageListeners,
    postMessage,
    deliver(raw: unknown) {
      for (const l of [...messageListeners]) l(raw);
    },
  };
};

const sampleMessage = (
  overrides: Partial<Message> = {},
): Message => ({
  type: MESSAGE_TYPE.APPLY,
  sender: MESSAGE_SENDER.INJECTOR,
  id: "id-1",
  path: ["emit"],
  args: [],
  meta: {},
  namespace: QUOTE_CHANNEL_NAMESPACE,
  timeStamp: 1,
  ...overrides,
});

describe("PortAdapter", () => {
  it("sendMessage delegates to port.postMessage", () => {
    const { port, postMessage } = fakePort();
    const adapter = new PortAdapter(port);
    const msg = sampleMessage();

    adapter.sendMessage(msg, []);

    expect(postMessage).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(msg);
  });

  it("sendMessage swallows postMessage failures (port disconnected mid-call)", () => {
    const { port, postMessage } = fakePort();
    postMessage.mockImplementation(() => {
      throw new Error("port disconnected");
    });
    const adapter = new PortAdapter(port);

    expect(() => adapter.sendMessage(sampleMessage(), [])).not.toThrow();
  });

  it("onMessage forwards messages on a maru channel namespace", () => {
    const { port, deliver } = fakePort();
    const adapter = new PortAdapter(port);
    const callback = vi.fn();

    adapter.onMessage(callback);
    const msg = sampleMessage({ namespace: COMPARISON_CHANNEL_NAMESPACE });
    deliver(msg);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(msg);
  });

  it("onMessage drops messages with an unknown namespace", () => {
    const { port, deliver } = fakePort();
    const adapter = new PortAdapter(port);
    const callback = vi.fn();

    adapter.onMessage(callback);
    deliver(sampleMessage({ namespace: "__not-maru__" }));
    deliver({ random: "noise" });

    expect(callback).not.toHaveBeenCalled();
  });

  it("onMessage returns a detach function that removes the listener", () => {
    const { port, messageListeners, deliver } = fakePort();
    const adapter = new PortAdapter(port);
    const callback = vi.fn();

    const off = adapter.onMessage(callback);
    expect(messageListeners.size).toBe(1);

    if (typeof off !== "function") throw new Error("expected an off fn");
    off();

    expect(messageListeners.size).toBe(0);

    deliver(sampleMessage());
    expect(callback).not.toHaveBeenCalled();
  });
});
