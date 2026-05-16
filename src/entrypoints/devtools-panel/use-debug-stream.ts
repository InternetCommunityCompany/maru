import { useEffect, useReducer } from "react";
import type {
  CandidatePhase,
  ScoreBreakdown,
  SessionKey,
  SessionPartialKey,
} from "@/arbiter/types";
import type { ComparisonSnapshot } from "@/comparison/types";
import type { DebugEvent } from "@/debug/debug-event";
import { connectWithReconnect } from "@/messaging/connect-with-reconnect";
import {
  DEBUG_PANEL_PORT_NAME,
  onDebugFromBackground,
  type DebugPanelHandshake,
} from "@/messaging/debug-panel-channel";

export type CandidateRow = {
  candidateId: string;
  phase: CandidatePhase;
  source: string;
  templateId: string;
  breakdown?: ScoreBreakdown;
  addedAt: number;
};

export type WinnerFlip = {
  at: number;
  nextId: string;
  previousId: string | null;
  score: number;
};

export type SessionView = {
  key: SessionKey;
  domain: string;
  partialKey: SessionPartialKey;
  openedAt: number;
  candidates: CandidateRow[];
  bestCandidateId: string | null;
  lastSequence: number;
  lastConfidence: number;
  winnerHistory: WinnerFlip[];
};

export type TemplateEvaluationRow = {
  at: number;
  interceptedId: string;
  result: "match" | "no_match";
  failedField?: string;
  extractions?: Record<string, unknown>;
};

export type TemplateRow = {
  templateId: string;
  version?: string;
  hostMatch?: string;
  loadedAt?: number;
  evaluations: TemplateEvaluationRow[];
};

export type HeuristicRow = {
  at: number;
  interceptedId: string;
  signal: string;
  matched: boolean;
  reason?: string;
  extractions?: Record<string, unknown>;
};

export type DebugStream = {
  events: DebugEvent[];
  sessions: Map<SessionKey, SessionView>;
  compareBySession: Map<SessionKey, ComparisonSnapshot>;
  templates: Map<string, TemplateRow>;
  heuristics: HeuristicRow[];
};

export const emptyDebugStream: DebugStream = {
  events: [],
  sessions: new Map(),
  compareBySession: new Map(),
  templates: new Map(),
  heuristics: [],
};

/**
 * Pure event-fold for the debug stream. Exported for unit testing without
 * React. Every case returns a new top-level object so React's `useReducer`
 * sees a fresh reference; the `events` log is appended on every event so
 * future tabs can subscribe to the raw stream without re-deriving.
 */
export function reduceDebugStream(
  state: DebugStream,
  event: DebugEvent,
): DebugStream {
  const events = [...state.events, event];
  switch (event.kind) {
    case "session_opened": {
      const sessions = new Map(state.sessions);
      sessions.set(event.sessionKey, {
        key: event.sessionKey,
        domain: event.domain,
        partialKey: event.partialKey,
        openedAt: event.at,
        candidates: [],
        bestCandidateId: null,
        lastSequence: 0,
        lastConfidence: 0,
        winnerHistory: [],
      });
      return { ...state, events, sessions };
    }
    case "candidate_added": {
      const prev = state.sessions.get(event.sessionKey);
      if (!prev) return { ...state, events };
      const sessions = new Map(state.sessions);
      sessions.set(event.sessionKey, {
        ...prev,
        candidates: [
          ...prev.candidates,
          {
            candidateId: event.candidateId,
            phase: event.phase,
            source: event.source,
            templateId: event.templateId,
            addedAt: event.at,
          },
        ],
      });
      return { ...state, events, sessions };
    }
    case "score_breakdown": {
      const prev = state.sessions.get(event.sessionKey);
      if (!prev) return { ...state, events };
      const sessions = new Map(state.sessions);
      sessions.set(event.sessionKey, {
        ...prev,
        candidates: prev.candidates.map((c) =>
          c.candidateId === event.candidateId
            ? { ...c, breakdown: event.breakdown }
            : c,
        ),
      });
      return { ...state, events, sessions };
    }
    case "best_changed": {
      const prev = state.sessions.get(event.sessionKey);
      if (!prev) return { ...state, events };
      const sessions = new Map(state.sessions);
      sessions.set(event.sessionKey, {
        ...prev,
        bestCandidateId: event.nextId,
        winnerHistory: [
          ...prev.winnerHistory,
          {
            at: event.at,
            nextId: event.nextId,
            previousId: event.previousId,
            score: event.score,
          },
        ],
      });
      return { ...state, events, sessions };
    }
    case "quote_emitted": {
      const prev = state.sessions.get(event.sessionKey);
      if (!prev) return { ...state, events };
      const sessions = new Map(state.sessions);
      sessions.set(event.sessionKey, {
        ...prev,
        lastSequence: event.sequence,
        lastConfidence: event.confidence,
      });
      return { ...state, events, sessions };
    }
    case "compare_snapshot": {
      const compareBySession = new Map(state.compareBySession);
      compareBySession.set(event.snapshot.update.sessionKey, event.snapshot);
      return { ...state, events, compareBySession };
    }
    case "template_loaded": {
      const templates = new Map(state.templates);
      const prev = templates.get(event.templateId) ?? {
        templateId: event.templateId,
        evaluations: [],
      };
      templates.set(event.templateId, {
        ...prev,
        version: event.version,
        hostMatch: event.hostMatch,
        loadedAt: event.at,
      });
      return { ...state, events, templates };
    }
    case "template_eval": {
      const templates = new Map(state.templates);
      const prev = templates.get(event.templateId) ?? {
        templateId: event.templateId,
        evaluations: [],
      };
      const row: TemplateEvaluationRow = {
        at: event.at,
        interceptedId: event.interceptedId,
        result: event.result,
        ...(event.failedField !== undefined
          ? { failedField: event.failedField }
          : {}),
      };
      templates.set(event.templateId, {
        ...prev,
        evaluations: [...prev.evaluations, row],
      });
      return { ...state, events, templates };
    }
    case "template_match": {
      const prev = state.templates.get(event.templateId);
      if (!prev) return { ...state, events };
      const evaluations = [...prev.evaluations];
      // Attach extractions to the most recent matching eval for this intercept.
      for (let i = evaluations.length - 1; i >= 0; i--) {
        const row = evaluations[i];
        if (
          row !== undefined &&
          row.interceptedId === event.interceptedId &&
          row.result === "match"
        ) {
          evaluations[i] = { ...row, extractions: event.extractions };
          break;
        }
      }
      const templates = new Map(state.templates);
      templates.set(event.templateId, { ...prev, evaluations });
      return { ...state, events, templates };
    }
    case "heuristic_eval": {
      const row: HeuristicRow = {
        at: event.at,
        interceptedId: event.interceptedId,
        signal: event.signal,
        matched: event.matched,
        ...(event.reason !== undefined ? { reason: event.reason } : {}),
      };
      return { ...state, events, heuristics: [...state.heuristics, row] };
    }
    case "heuristic_match": {
      const heuristics = [...state.heuristics];
      for (let i = heuristics.length - 1; i >= 0; i--) {
        const row = heuristics[i];
        if (
          row !== undefined &&
          row.interceptedId === event.interceptedId &&
          row.matched
        ) {
          heuristics[i] = { ...row, extractions: event.extractions };
          break;
        }
      }
      return { ...state, events, heuristics };
    }
    default:
      return state;
  }
}

/**
 * Subscribe to the dev `maru:debug-panel` port for the tab currently
 * inspected by this DevTools window. The panel performs a one-shot handshake
 * with `browser.devtools.inspectedWindow.tabId` on each (re)connect so the
 * background can attach the right per-tab buffer.
 *
 * @returns A folded view over the in-memory event log — empty until events
 * start arriving. No backfill; events from before the panel opened are lost
 * (matches the extension's "open DevTools first" workflow).
 */
export function useDebugStream(): DebugStream {
  const [state, dispatch] = useReducer(reduceDebugStream, emptyDebugStream);

  useEffect(() => {
    const tabId = browser.devtools.inspectedWindow.tabId;
    const reconnector = connectWithReconnect(DEBUG_PANEL_PORT_NAME, (port) => {
      const handshake: DebugPanelHandshake = { tabId };
      port.postMessage(handshake);
      onDebugFromBackground(port, (event) => dispatch(event));
    });
    return () => reconnector.close();
  }, []);

  return state;
}
