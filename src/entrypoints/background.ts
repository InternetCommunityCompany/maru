import { BackgroundAdapter, provideEventChannel } from "@/messaging";

export default defineBackground(() => {
  provideEventChannel(new BackgroundAdapter(), (event) => {
    if (event.kind === "json-rpc") {
      console.log(
        `[maru rpc] ${event.source} ${event.phase} ${event.method}`,
        event,
      );
    } else {
      console.log(
        `[maru http] ${event.source} ${event.phase} ${event.method} ${event.url}`,
        event,
      );
    }
  });
});
