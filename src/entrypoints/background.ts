import { BackgroundAdapter } from "@/messaging/background-adapter";
import { provideEventChannel } from "@/messaging/channel";
import { createQuoteReducer } from "@/quote-reducer/quote-reducer";

export default defineBackground(() => {
  const reducer = createQuoteReducer();

  // Log only on actual map changes — out-of-order arrivals are dropped
  // silently inside the reducer, so the dev terminal shows one line per
  // visible state change instead of one per emission.
  reducer.subscribe((change) => {
    if (change.type === "evicted") {
      console.log(`[maru -] session ${change.sessionKey} evicted (idle)`);
      return;
    }
    const { swap } = change.update;
    const tag = change.type === "added" ? "+" : "~";
    console.log(
      `[maru ${tag}${swap.type}] ${swap.domain} via ${swap.provider ?? swap.templateId}: ` +
        `${swap.amountIn} ${swap.tokenIn} → ${swap.amountOut} ${swap.tokenOut} ` +
        `(seq ${change.update.sequence}, conf ${change.update.confidence.toFixed(2)})`,
      change.update,
    );
  });

  provideEventChannel(new BackgroundAdapter(), (update) =>
    reducer.ingest(update),
  );
});
