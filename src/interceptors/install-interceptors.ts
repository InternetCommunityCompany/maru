import type { InterceptedEvent } from "./types";
import { installFetchInterceptor } from "./fetch";
import { installXhrInterceptor } from "./xhr";
import { installEthereumInterceptor } from "./ethereum";

/**
 * Installs the fetch, XHR, and ethereum interceptors against a shared `emit`.
 *
 * Convenience for entrypoints that want everything; individual installers can
 * also be imported from their own files when only one is needed.
 */
export function installInterceptors(
  emit: (event: InterceptedEvent) => void,
): void {
  installFetchInterceptor(emit);
  installXhrInterceptor(emit);
  installEthereumInterceptor(emit);
}
