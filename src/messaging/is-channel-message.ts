import { type Message, checkMessage } from "comctx";
import { CHANNEL_NAMESPACES } from "./namespace";

/**
 * Type guard: does `data` look like a comctx message on any maru channel?
 *
 * Used by every adapter and the relay to drop messages from other extensions,
 * page scripts that happen to use `postMessage`, or unrelated comctx channels.
 * Validates the comctx envelope shape and that the namespace belongs to one
 * of maru's channels (see `CHANNEL_NAMESPACES`); comctx itself then routes
 * the message to the proxy with the matching namespace.
 */
export const isChannelMessage = (data: unknown): data is Partial<Message> => {
  if (!checkMessage(data as Partial<Message>)) return false;
  const ns = (data as Partial<Message>).namespace;
  return typeof ns === "string" && CHANNEL_NAMESPACES.has(ns);
};
