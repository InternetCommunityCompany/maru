import type { InterceptedEvent, ParsedEvent } from "@/types";
import {
  parseRpcRequest,
  parseRpcResponse,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./json-rpc";

export function parse(event: InterceptedEvent): ParsedEvent[] {
  if (event.source === "ethereum") return [parseEthereumEvent(event)];
  return parseHttpEvent(event);
}

function parseEthereumEvent(
  event: Extract<InterceptedEvent, { source: "ethereum" }>,
): ParsedEvent {
  return {
    kind: "json-rpc",
    source: "ethereum",
    phase: event.phase,
    id: event.id,
    method: event.method,
    params: event.params,
    result: event.result,
    error: event.error,
    transport: event.providerInfo
      ? { providerInfo: event.providerInfo }
      : undefined,
    raw: event,
  };
}

function parseHttpEvent(
  event: Extract<InterceptedEvent, { source: "fetch" | "xhr" }>,
): ParsedEvent[] {
  const requestParsed = parseRpcRequest(event.requestBody);
  if (!requestParsed) {
    return [
      {
        kind: "http",
        source: event.source,
        phase: event.phase,
        id: event.id,
        url: event.url,
        method: event.method,
        status: event.status,
        error: event.error,
        raw: event,
      },
    ];
  }

  const responseParsed =
    event.phase === "response"
      ? parseRpcResponse(event.responseBody)
      : undefined;

  const requests = Array.isArray(requestParsed)
    ? requestParsed
    : [requestParsed];
  const responsesByIndex = (() => {
    if (!responseParsed) return new Map<number, JsonRpcResponse>();
    const list = Array.isArray(responseParsed)
      ? responseParsed
      : [responseParsed];
    const byId = new Map<string | number, JsonRpcResponse>();
    for (const r of list) if (r.id != null) byId.set(r.id, r);
    return new Map<number, JsonRpcResponse>(
      requests.map((req, i) => {
        const matched =
          req.id != null ? byId.get(req.id) : list[i];
        return [i, matched as JsonRpcResponse];
      }),
    );
  })();

  return requests.map((req, i) => buildJsonRpcParsed(event, req, responsesByIndex.get(i)));
}

function buildJsonRpcParsed(
  event: Extract<InterceptedEvent, { source: "fetch" | "xhr" }>,
  req: JsonRpcRequest,
  res: JsonRpcResponse | undefined,
): ParsedEvent {
  const errorMessage = event.error ?? res?.error?.message;
  return {
    kind: "json-rpc",
    source: event.source,
    phase: errorMessage && event.phase !== "response" ? event.phase : event.phase,
    id: `${event.id}#${req.id ?? "_"}`,
    method: req.method,
    params: req.params,
    result: res?.result,
    error: errorMessage,
    transport: { url: event.url, status: event.status },
    raw: event,
  };
}
