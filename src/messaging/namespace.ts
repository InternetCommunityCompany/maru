/**
 * comctx namespace shared by every party on the channel (page, content,
 * background). Used both to scope `defineProxy` and to filter incoming
 * messages so we don't pick up traffic from other extensions or page scripts.
 */
export const CHANNEL_NAMESPACE = "__maru-event-channel__";
