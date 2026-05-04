import type { InterceptedEvent } from "@/types";
import { installFetchInterceptor } from "./fetch";
import { installXhrInterceptor } from "./xhr";
import { installEthereumInterceptor } from "./ethereum";

export function installInterceptors(
  emit: (event: InterceptedEvent) => void,
): void {
  installFetchInterceptor(emit);
  installXhrInterceptor(emit);
  installEthereumInterceptor(emit);
}

export { installFetchInterceptor, installXhrInterceptor, installEthereumInterceptor };
