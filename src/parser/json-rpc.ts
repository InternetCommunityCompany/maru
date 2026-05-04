export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc?: string;
  id?: string | number | null;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

const looksLikeRpcRequest = (value: unknown): value is JsonRpcRequest =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as JsonRpcRequest).method === "string";

const looksLikeRpcResponse = (value: unknown): value is JsonRpcResponse =>
  typeof value === "object" &&
  value !== null &&
  ("result" in value || "error" in value) &&
  "id" in value;

export const tryParseJson = (text: string | null | undefined): unknown => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const parseRpcRequest = (
  text: string | null | undefined,
): JsonRpcRequest | JsonRpcRequest[] | undefined => {
  const value = tryParseJson(text);
  if (Array.isArray(value) && value.every(looksLikeRpcRequest)) return value;
  if (looksLikeRpcRequest(value)) return value;
  return undefined;
};

export const parseRpcResponse = (
  text: string | null | undefined,
): JsonRpcResponse | JsonRpcResponse[] | undefined => {
  const value = tryParseJson(text);
  if (Array.isArray(value) && value.every(looksLikeRpcResponse)) return value;
  if (looksLikeRpcResponse(value)) return value;
  return undefined;
};
