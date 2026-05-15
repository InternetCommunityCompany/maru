import { BACKEND_URL } from "@/backend-url";
import type { BestQuote, QuoteRequest } from "./types";

/**
 * Discriminated outcome of `fetchBestQuote`.
 *
 * `ok` carries the parsed `BestQuote`. `no_opinion` indicates the backend
 * returned `204` (no upstream had an answer). `failed` covers everything else
 * — non-2xx HTTP, network errors, timeouts, malformed bodies — and is
 * deliberately coarse: callers (the orchestrator) only branch on whether a
 * `ComparisonSnapshot` should be `result` / `no_opinion` / `failed`, and the
 * reason doesn't drive product behavior in V1.
 *
 * `aborted` is separate from `failed` so the orchestrator can drop the
 * outcome silently when it intentionally cancelled the request (session
 * evicted mid-flight) instead of emitting a `failed` snapshot.
 */
export type FetchBestQuoteOutcome =
  | { status: "ok"; quote: BestQuote }
  | { status: "no_opinion" }
  | { status: "failed"; reason: string }
  | { status: "aborted" };

/** Options for `fetchBestQuote`. */
export type FetchBestQuoteOptions = {
  /** AbortSignal — `fetchBestQuote` resolves with `{status: "aborted"}` when this fires. */
  signal?: AbortSignal;
  /** Override the request timeout (ms). Defaults to `DEFAULT_FETCH_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Override the global `fetch` — for tests. */
  fetchImpl?: typeof fetch;
};

/**
 * Default per-request timeout (ms) for the backend `POST /api/quotes` call.
 *
 * The backend itself fans out to upstream aggregators with their own deadlines.
 * 8 s is generous enough to cover a worst-case upstream while still feeling
 * unresponsive to the user if it ever exhausts — at which point we fall through
 * to a `failed` snapshot.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

/**
 * POST `req` to the backend's `/api/quotes` and translate the HTTP outcome
 * into a `FetchBestQuoteOutcome`.
 *
 * Lives in the background service worker — that's where `host_permissions`
 * makes `fetch()` callable without per-tab CORS. The orchestrator passes an
 * `AbortSignal` so an in-flight request can be cancelled when the session is
 * evicted.
 *
 * @remarks
 * Outcome mapping:
 * - `200 OK` with parseable JSON → `ok`
 * - `204 No Content` → `no_opinion`
 * - Anything else (non-2xx, network, timeout, JSON parse failure) → `failed`
 * - `signal.aborted` (either pre-call or during the request) → `aborted`
 *
 * The response body is NOT schema-validated against `BestQuote` beyond the
 * presence of `provider` and `amountOut` — the backend owns the schema and
 * this client is a thin transport. Adding Zod validation here would duplicate
 * the backend's contract.
 */
export async function fetchBestQuote(
  req: QuoteRequest,
  options: FetchBestQuoteOptions = {},
): Promise<FetchBestQuoteOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  if (options.signal?.aborted) return { status: "aborted" };

  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = options.signal
    ? anySignal([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetchImpl(`${BACKEND_URL}/api/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });

    if (response.status === 204) return { status: "no_opinion" };
    if (!response.ok) {
      return { status: "failed", reason: `http_${response.status}` };
    }

    const body = (await response.json()) as Partial<BestQuote>;
    if (
      typeof body.provider !== "string" ||
      typeof body.amountOut !== "string"
    ) {
      return { status: "failed", reason: "malformed_response" };
    }
    return { status: "ok", quote: body as BestQuote };
  } catch (err) {
    if (options.signal?.aborted) return { status: "aborted" };
    if (timeoutController.signal.aborted) {
      return { status: "failed", reason: "timeout" };
    }
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "network",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// Combines multiple AbortSignals into a single signal that aborts when any
// input does. Standard `AbortSignal.any` is missing in some service-worker
// runtimes, so we open-code it.
const anySignal = (signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();
  const onAbort = (event: Event) => {
    const target = event.target as AbortSignal;
    controller.abort(target.reason);
  };
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      return controller.signal;
    }
    s.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
};
