import { BACKEND_URL } from "@/backend-url";
import type { BestQuote, QuoteRequest } from "./types";

/**
 * `failed.reason` is coarse — the orchestrator doesn't branch on it. `aborted`
 * is split out so the orchestrator can drop the outcome silently when it
 * intentionally cancelled (session evicted) instead of emitting a `failed`
 * snapshot.
 */
export type FetchBestQuoteOutcome =
  | { status: "ok"; quote: BestQuote }
  | { status: "no_opinion" }
  | { status: "failed"; reason: string }
  | { status: "aborted" };

export type FetchBestQuoteOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Override the global `fetch` for tests. */
  fetchImpl?: typeof fetch;
};

/** Generous enough for the backend's upstream fan-out, snappy enough to feel responsive. */
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

/**
 * POST `req` to `/api/quotes` and translate the HTTP outcome into a
 * {@link FetchBestQuoteOutcome}. 200 → `ok` (with body validated by
 * {@link isBestQuote}), 204 → `no_opinion`, anything else → `failed`,
 * aborted-signal → `aborted`. Background-only — the backend host permission
 * is what makes the call CORS-free.
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
