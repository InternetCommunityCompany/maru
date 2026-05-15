import type { QuoteUpdate } from "@/arbiter/types";

export const QUOTE_UPDATE_MESSAGE_TYPE = "__maru_quote_update__";

export type QuoteUpdateMessage = {
  type: typeof QUOTE_UPDATE_MESSAGE_TYPE;
  update: QuoteUpdate;
};

export function createQuoteUpdateMessage(update: QuoteUpdate): QuoteUpdateMessage {
  return { type: QUOTE_UPDATE_MESSAGE_TYPE, update };
}

export function postQuoteUpdate(update: QuoteUpdate): void {
  window.postMessage(createQuoteUpdateMessage(update), window.location.origin);
}

export function isQuoteUpdateMessage(value: unknown): value is QuoteUpdateMessage {
  if (!isRecord(value)) return false;
  return value.type === QUOTE_UPDATE_MESSAGE_TYPE && isQuoteUpdate(value.update);
}

function isQuoteUpdate(value: unknown): value is QuoteUpdate {
  if (!isRecord(value)) return false;
  return (
    isSwapEvent(value.swap) &&
    typeof value.sessionKey === "string" &&
    Number.isSafeInteger(value.sequence) &&
    typeof value.confidence === "number" &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    typeof value.candidateId === "string"
  );
}

function isSwapEvent(value: unknown): value is QuoteUpdate["swap"] {
  if (!isRecord(value)) return false;
  return (
    value.kind === "swap" &&
    (value.type === "swap" || value.type === "bridge") &&
    typeof value.templateId === "string" &&
    typeof value.domain === "string" &&
    Number.isSafeInteger(value.chainIn) &&
    Number.isSafeInteger(value.chainOut) &&
    typeof value.tokenIn === "string" &&
    typeof value.tokenOut === "string" &&
    typeof value.amountIn === "string" &&
    typeof value.amountOut === "string" &&
    isRecord(value.transport)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
