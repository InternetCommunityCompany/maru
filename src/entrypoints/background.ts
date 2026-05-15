import { createComparisonOrchestrator } from "@/comparison/comparison-orchestrator";
import { fetchBestQuote } from "@/comparison/fetch-best-quote";
import { BackgroundAdapter } from "@/messaging/background-adapter";
import { injectComparisonChannel } from "@/messaging/comparison-channel";
import { provideQuoteChannel } from "@/messaging/quote-channel";
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

  // Producer side of the comparison channel — consumer wiring lives in the
  // surfaces that subscribe (MAR-31..35, dev overlay). The orchestrator is
  // the only emitter.
  const comparisonChannel = injectComparisonChannel(new BackgroundAdapter());
  createComparisonOrchestrator({
    reducer,
    fetchBestQuote,
    emit: (snapshot) => {
      void comparisonChannel.emit(snapshot).catch(() => {});
    },
  });

  provideQuoteChannel(new BackgroundAdapter(), (update) =>
    reducer.ingest(update),
  );
});
