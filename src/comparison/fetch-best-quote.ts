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
 * Response bodies are validated against the {@link BestQuote} shape at this
 * boundary by {@link isBestQuote} — a malformed response (e.g. backend
 * regression that ships `fetchedAt: "now"`) becomes a `failed` outcome
 * here instead of exploding at render time.
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
    ? AbortSignal.any([options.signal, timeoutController.signal])
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

    const body: unknown = await response.json();
    if (!isBestQuote(body)) {
      return { status: "failed", reason: "malformed_response" };
    }
    return { status: "ok", quote: body };
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

const AMOUNT_RE = /^\d+$/u;

// Mirrors the BestQuote type from maru-backend/src/types.ts. Kept in sync by
// hand — adding zod here just to validate one response shape would dwarf the
// rule it enforces.
const isBestQuote = (body: unknown): body is BestQuote => {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.provider !== "string" || b.provider.length === 0) return false;
  if (typeof b.amountOut !== "string" || !AMOUNT_RE.test(b.amountOut)) {
    return false;
  }
  if (typeof b.fetchedAt !== "number" || !Number.isFinite(b.fetchedAt)) {
    return false;
  }
  if (b.routing !== undefined && typeof b.routing !== "string") return false;
  if (b.gas !== undefined) {
    if (typeof b.gas !== "object" || b.gas === null) return false;
    const g = b.gas as Record<string, unknown>;
    if (typeof g.units !== "string" || !AMOUNT_RE.test(g.units)) return false;
    if (g.usd !== undefined && (typeof g.usd !== "number" || !Number.isFinite(g.usd))) {
      return false;
    }
  }
  // `raw` is the opaque pass-through bag — accept anything, including absent.
  return true;
};
