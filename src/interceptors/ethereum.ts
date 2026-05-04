import type { InterceptedEvent } from "./types";
import { makeIdGenerator } from "./make-id-generator";

type RequestArgs = { method: string; params?: unknown };
type EthereumProvider = {
  request: (args: RequestArgs) => Promise<unknown>;
  [key: string]: unknown;
};
type Eip6963ProviderInfo = {
  uuid?: string;
  name?: string;
  rdns?: string;
  icon?: string;
};
type Eip6963Detail = { info?: Eip6963ProviderInfo; provider?: EthereumProvider };

const PATCHED = Symbol.for("maru-ethereum-patched");

/**
 * Patches every reachable EIP-1193 provider to emit `InterceptedEvent`s for
 * each `request({ method, params })` call.
 *
 * Covers three injection paths:
 *   1. A provider already on `window.ethereum` at `document_start`.
 *   2. A provider assigned to `window.ethereum` later (trapped via a
 *      configurable property setter, with a 10s polling fallback if the
 *      property was already locked by another extension).
 *   3. EIP-6963 providers (subscribes to `eip6963:announceProvider` and
 *      dispatches `eip6963:requestProvider` to flush already-loaded ones).
 *
 * Each provider is patched at most once — re-runs are idempotent via a
 * symbol-keyed marker on the provider object.
 */
export function installEthereumInterceptor(
  emit: (event: InterceptedEvent) => void,
): void {
  const nextId = makeIdGenerator("eth");

  const patch = (
    provider: EthereumProvider | undefined,
    info?: Eip6963ProviderInfo,
  ) => {
    if (!provider || typeof provider.request !== "function") return;
    const tagged = provider as EthereumProvider & { [PATCHED]?: boolean };
    if (tagged[PATCHED]) return;
    tagged[PATCHED] = true;

    const original = provider.request.bind(provider);
    provider.request = async function patchedRequest(args: RequestArgs) {
      const id = nextId();
      const method = args?.method ?? "<unknown>";
      const params = args?.params;
      emit({
        source: "ethereum",
        phase: "request",
        id,
        method,
        params,
        providerInfo: info,
      });
      try {
        const result = await original(args);
        emit({
          source: "ethereum",
          phase: "response",
          id,
          method,
          params,
          result,
          providerInfo: info,
        });
        return result;
      } catch (err) {
        emit({
          source: "ethereum",
          phase: "error",
          id,
          method,
          params,
          error: err instanceof Error ? err.message : String(err),
          providerInfo: info,
        });
        throw err;
      }
    };
  };

  // 1. Existing global provider (legacy injection).
  const existing = (window as unknown as { ethereum?: EthereumProvider })
    .ethereum;
  patch(existing);

  // 2. Late-injected global provider — trap reassignments to window.ethereum.
  let stored: EthereumProvider | undefined = existing;
  try {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      get() {
        return stored;
      },
      set(value: EthereumProvider | undefined) {
        stored = value;
        patch(value);
      },
    });
  } catch {
    // Some wallets define non-configurable properties — fall back to polling.
    const interval = setInterval(() => {
      const current = (window as unknown as { ethereum?: EthereumProvider })
        .ethereum;
      if (current && current !== stored) {
        stored = current;
        patch(current);
      }
    }, 200);
    setTimeout(() => clearInterval(interval), 10_000);
  }

  // 3. EIP-6963 announced providers.
  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Detail>).detail;
    if (detail?.provider) patch(detail.provider, detail.info);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}
