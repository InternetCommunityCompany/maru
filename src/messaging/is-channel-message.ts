import { type Message, checkMessage } from "comctx";
import { CHANNEL_NAMESPACE } from "./namespace";

/**
 * Type guard: does `data` look like a comctx message on our channel?
 *
 * Used by every adapter and the relay to drop messages from other extensions,
 * page scripts that happen to use `postMessage`, or unrelated comctx channels.
 * Validates both the comctx envelope shape and our specific namespace.
 */
export const isChannelMessage = (data: unknown): data is Partial<Message> =>
  checkMessage(data as Partial<Message>) &&
  (data as Partial<Message>).namespace === CHANNEL_NAMESPACE;
