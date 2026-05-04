export type Phase = "request" | "response" | "error";

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

export type EventSource = InterceptedEvent["source"];

export type ParsedEvent =
  | {
      kind: "json-rpc";
      source: EventSource;
      phase: Phase;
      id: string;
      method: string;
      params?: unknown;
      result?: unknown;
      error?: string;
      transport?: { url?: string; status?: number; providerInfo?: { uuid?: string; name?: string; rdns?: string } };
      raw: InterceptedEvent;
    }
  | {
      kind: "http";
      source: "fetch" | "xhr";
      phase: Phase;
      id: string;
      url: string;
      method: string;
      status?: number;
      error?: string;
      raw: InterceptedEvent;
    };
