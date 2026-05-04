import type { InterceptedEvent } from "@/interceptors/types";
import { evaluate } from "./evaluate";
import type { EvalContext, SwapEvent, Template } from "./types";

const REQUIRED_FIELDS = [
  "chainIn",
  "chainOut",
  "tokenIn",
  "tokenOut",
  "amountIn",
  "amountOut",
] as const;

const NUMBER_FIELDS = new Set<string>(["chainIn", "chainOut"]);

const STRING_FIELDS = new Set<string>([
  "tokenIn",
  "tokenOut",
  "amountIn",
  "amountOut",
  "amountOutMin",
  "fromAddress",
  "toAddress",
  "provider",
]);

const coerceField = (key: string, value: unknown): unknown => {
  if (value == null) return undefined;
  if (NUMBER_FIELDS.has(key)) {
    const n = typeof value === "number" ? value : parseInt(String(value), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  if (STRING_FIELDS.has(key)) return String(value);
  return value;
};

/**
 * Evaluates a template's `extract.fields` against `ctx` and assembles a
 * `SwapEvent`. Returns `null` if any required field (`chainIn`, `chainOut`,
 * `tokenIn`, `tokenOut`, `amountIn`, `amountOut`) is missing — this is what
 * makes the required set double as a match validator. `chainIn`/`chainOut`
 * are coerced to numbers, the rest to strings; unknown fields pass through
 * as-is.
 */
export const buildSwapEvent = (
  template: Template,
  matchedDomain: string,
  event: Extract<InterceptedEvent, { source: "fetch" | "xhr" }>,
  ctx: EvalContext,
): SwapEvent | null => {
  const out: Record<string, unknown> = {};
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
    transport: { url: event.url, method: event.method, source: event.source },
  };
};
