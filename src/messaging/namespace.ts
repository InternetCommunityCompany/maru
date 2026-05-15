/**
 * Set of comctx namespaces owned by maru. Every adapter and the relay use
 * this to drop messages from other extensions, page scripts that happen to
 * use `postMessage`, or unrelated comctx channels.
 *
 * Each maru channel (quote, comparison, …) registers its own namespace string
 * here. Keep this in sync when adding a new channel.
 */
export const CHANNEL_NAMESPACES: ReadonlySet<string> = new Set([
  "__maru-quote-channel__",
  "__maru-comparison-channel__",
]);

/** Wire namespace for the quote channel (`QuoteUpdate` payloads). */
export const QUOTE_CHANNEL_NAMESPACE = "__maru-quote-channel__";

/** Wire namespace for the comparison channel (`ComparisonSnapshot` payloads). */
export const COMPARISON_CHANNEL_NAMESPACE = "__maru-comparison-channel__";
