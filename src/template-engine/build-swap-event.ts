import type { InterceptedEvent } from "@/interceptors/install-interceptors";
import type { EvalContext } from "./build-eval-context";
import { coerceChainId } from "./coerce-chain-id";
import { evaluate } from "./evaluate";
import type { Template } from "./match-templates";
import { normalizeTokenAddress } from "./normalize-token-address";

/**
 * A normalized swap or bridge quote extracted by a template.
 *
 * `type` is `"bridge"` if `chainIn !== chainOut`, otherwise `"swap"`. The
 * required fields (`chainIn`, `chainOut`, `tokenIn`, `tokenOut`, `amountIn`,
 * `amountOut`) are the minimum to express a rate — if any can't be resolved,
 * the engine drops the event rather than emitting a partial. Token symbols,
 * decimals, USD values, and gas costs are intentionally absent: consumers
 * resolve them from on-chain data or oracles.
 *
 * `transport` discriminates on the originating interceptor: HTTP carries the
 * URL, ethereum carries the wallet's announced provider info (when present).
 */
export type SwapEvent = {
  kind: "swap";
  type: "swap" | "bridge";
  templateId: string;
  domain: string;
  chainIn: number;
  chainOut: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountOutMin?: string;
  fromAddress?: string;
  toAddress?: string;
  provider?: string;
  transport:
    | { source: "fetch" | "xhr"; url: string; method: string }
    | {
        source: "ethereum";
        method: string;
        providerInfo?: { uuid?: string; name?: string; rdns?: string };
      };
};

const REQUIRED_FIELDS = [
  "chainIn",
  "chainOut",
  "tokenIn",
  "tokenOut",
  "amountIn",
  "amountOut",
] as const;

const NUMBER_FIELDS = new Set<string>(["chainIn", "chainOut"]);

const TOKEN_FIELDS = new Set<string>(["tokenIn", "tokenOut"]);

const STRING_FIELDS = new Set<string>([
  "amountIn",
  "amountOut",
  "amountOutMin",
  "fromAddress",
  "toAddress",
  "provider",
]);

const coerceField = (key: string, value: unknown): unknown => {
  if (value == null) return undefined;
  if (TOKEN_FIELDS.has(key)) return normalizeTokenAddress(value) ?? undefined;
  if (NUMBER_FIELDS.has(key)) return coerceChainId(value) ?? undefined;
  if (STRING_FIELDS.has(key)) return String(value);
  return value;
};

const buildTransport = (event: InterceptedEvent): SwapEvent["transport"] =>
  event.source === "ethereum"
    ? {
        source: "ethereum",
        method: event.method,
        providerInfo: event.providerInfo,
      }
    : { source: event.source, url: event.url, method: event.method };

/**
 * Evaluates a template's `extract.static` and `extract.fields` against `ctx`
 * and assembles a `SwapEvent`.
 *
 * Static values are applied first as defaults; path-expression `fields`
 * override them when they resolve. Returns `null` if any required field
 * (`chainIn`, `chainOut`, `tokenIn`, `tokenOut`, `amountIn`, `amountOut`) is
 * missing — this is what makes the required set double as a match
 * validator. `chainIn`/`chainOut` are coerced to numbers (with `bigint`
 * handled), the rest to strings (which `String(bigint)` stringifies
 * losslessly); unknown fields pass through as-is.
 */
export const buildSwapEvent = (
  template: Template,
  matchedDomain: string,
  event: InterceptedEvent,
  ctx: EvalContext,
): SwapEvent | null => {
  const out: Record<string, unknown> = {};
  if (template.extract.static) {
    for (const [field, value] of Object.entries(template.extract.static)) {
      const coerced = coerceField(field, value);
      if (coerced !== undefined) out[field] = coerced;
    }
  }
  for (const [field, expr] of Object.entries(template.extract.fields)) {
    const value = coerceField(field, evaluate(expr, ctx));
    if (value !== undefined) out[field] = value;
  }
  for (const required of REQUIRED_FIELDS) {
    if (out[required] === undefined) return null;
  }
  const chainIn = out.chainIn as number;
  const chainOut = out.chainOut as number;
  return {
    kind: "swap",
    type: chainIn === chainOut ? "swap" : "bridge",
    templateId: template.id,
    domain: matchedDomain,
    chainIn,
    chainOut,
    tokenIn: out.tokenIn as string,
    tokenOut: out.tokenOut as string,
    amountIn: out.amountIn as string,
    amountOut: out.amountOut as string,
    amountOutMin: out.amountOutMin as string | undefined,
    fromAddress: out.fromAddress as string | undefined,
    toAddress: out.toAddress as string | undefined,
    provider: out.provider as string | undefined,
    transport: buildTransport(event),
  };
};
