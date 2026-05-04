type Phase = "request" | "response" | "error";

/**
 * A raw event emitted by an interceptor for each request/response phase.
 *
 * Discriminated by `source`. The fetch and XHR variants share an HTTP shape;
 * the ethereum variant carries already-decoded EIP-1193 calls. The `id` is
 * stable across the request and response phases of the same call so consumers
 * can correlate them.
 */
export type InterceptedEvent =
  | {
      source: "fetch";
      phase: Phase;
      id: string;
      url: string;
      method: string;
      requestBody?: string | null;
      status?: number;
      ok?: boolean;
      responseBody?: string | null;
      error?: string;
    }
  | {
      source: "xhr";
      phase: Phase;
      id: string;
      url: string;
      method: string;
      requestBody?: string | null;
      status?: number;
      responseBody?: string | null;
      error?: string;
    }
  | {
      source: "ethereum";
      phase: Phase;
      id: string;
      providerInfo?: { uuid?: string; name?: string; rdns?: string };
      method: string;
      params?: unknown;
      result?: unknown;
      error?: string;
    };
