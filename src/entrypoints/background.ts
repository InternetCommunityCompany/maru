import { BackgroundAdapter } from "@/messaging/background-adapter";
import { provideEventChannel } from "@/messaging/channel";

export default defineBackground(() => {
  provideEventChannel(new BackgroundAdapter(), (event) => {
    console.log(
      `[maru ${event.type}] ${event.domain} via ${event.provider ?? event.templateId}: ` +
        `${event.amountIn} ${event.tokenIn} (chain ${event.chainIn}) ` +
        `→ ${event.amountOut} ${event.tokenOut} (chain ${event.chainOut})`,
      event,
    );
  });
});
