import { describe, expect, it } from "vitest";
import type { ScoreBreakdown } from "@/arbiter/types";
import type { ComparisonSnapshot } from "@/comparison/types";
import type { DebugEvent } from "@/debug/debug-event";
import type { SwapEvent } from "@/template-engine/build-swap-event";
import {
  emptyDebugStream,
  reduceDebugStream,
  type DebugStream,
} from "./use-debug-stream";

const SESSION = "session-1";

const swap: SwapEvent = {
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: "0xaaa",
  tokenOut: "0xbbb",
  amountIn: "1000",
  amountOut: "2000",
  transport: {
    source: "fetch",
    url: "https://example.test/quote",
    method: "POST",
  },
};

const breakdown: ScoreBreakdown = {
  provenance: 0.6,
  phase: 0.2,
  rank: 0.123,
  grounding: 0,
  total: 0.923,
};

const fold = (events: DebugEvent[]): DebugStream =>
  events.reduce(reduceDebugStream, emptyDebugStream);

const opened: DebugEvent = {
  kind: "session_opened",
  at: 100,
  sessionKey: SESSION,
  domain: "app.example.xyz",
  partialKey: "partial-1",
};

const candidate = (id: string, at: number): DebugEvent => ({
  kind: "candidate_added",
  at,
  sessionKey: SESSION,
  candidateId: id,
  phase: "response",
  source: "fetch",
  templateId: "uniswap",
});

describe("reduceDebugStream: sessions", () => {
  it("creates a session view on session_opened", () => {
    const state = fold([opened]);
    const view = state.sessions.get(SESSION);
    expect(view).toBeDefined();
    expect(view?.domain).toBe("app.example.xyz");
    expect(view?.partialKey).toBe("partial-1");
    expect(view?.openedAt).toBe(100);
    expect(view?.candidates).toEqual([]);
    expect(view?.bestCandidateId).toBeNull();
    expect(view?.winnerHistory).toEqual([]);
    expect(state.events).toHaveLength(1);
  });

  it("appends to candidates on candidate_added", () => {
    const state = fold([opened, candidate("cand-a", 110), candidate("cand-b", 120)]);
    const view = state.sessions.get(SESSION);
    expect(view?.candidates.map((c) => c.candidateId)).toEqual([
      "cand-a",
      "cand-b",
    ]);
    expect(view?.candidates[0]?.addedAt).toBe(110);
  });

  it("ignores candidate_added when the session is missing", () => {
    const state = fold([candidate("orphan", 50)]);
    expect(state.sessions.size).toBe(0);
    // Event is still recorded in the raw log.
    expect(state.events).toHaveLength(1);
  });

  it("attaches the breakdown to the named candidate on score_breakdown", () => {
    const state = fold([
      opened,
      candidate("cand-a", 110),
      candidate("cand-b", 120),
      {
        kind: "score_breakdown",
        at: 121,
        sessionKey: SESSION,
        candidateId: "cand-b",
        breakdown,
      },
    ]);
    const view = state.sessions.get(SESSION);
    expect(view?.candidates[0]?.breakdown).toBeUndefined();
    expect(view?.candidates[1]?.breakdown).toEqual(breakdown);
  });

  it("no-ops score_breakdown when the session is missing", () => {
    const state = fold([
      {
        kind: "score_breakdown",
        at: 121,
        sessionKey: SESSION,
        candidateId: "cand-b",
        breakdown,
      },
    ]);
    expect(state.sessions.size).toBe(0);
    expect(state.events).toHaveLength(1);
  });

  it("updates bestCandidateId and appends to winnerHistory on best_changed", () => {
    const state = fold([
      opened,
      candidate("cand-a", 110),
      {
        kind: "best_changed",
        at: 111,
        sessionKey: SESSION,
        previousId: null,
        nextId: "cand-a",
        score: 0.8,
      },
      candidate("cand-b", 120),
      {
        kind: "best_changed",
        at: 121,
        sessionKey: SESSION,
        previousId: "cand-a",
        nextId: "cand-b",
        score: 0.9,
      },
    ]);
    const view = state.sessions.get(SESSION);
    expect(view?.bestCandidateId).toBe("cand-b");
    expect(view?.winnerHistory).toEqual([
      { at: 111, nextId: "cand-a", previousId: null, score: 0.8 },
      { at: 121, nextId: "cand-b", previousId: "cand-a", score: 0.9 },
    ]);
  });

  it("updates lastSequence and lastConfidence on quote_emitted", () => {
    const state = fold([
      opened,
      candidate("cand-a", 110),
      {
        kind: "quote_emitted",
        at: 115,
        sessionKey: SESSION,
        sequence: 1,
        candidateId: "cand-a",
        confidence: 0.6,
      },
      {
        kind: "quote_emitted",
        at: 200,
        sessionKey: SESSION,
        sequence: 2,
        candidateId: "cand-a",
        confidence: 0.9,
      },
    ]);
    const view = state.sessions.get(SESSION);
    expect(view?.lastSequence).toBe(2);
    expect(view?.lastConfidence).toBe(0.9);
  });
});

describe("reduceDebugStream: compare", () => {
  it("indexes the latest snapshot per session", () => {
    const snap1: ComparisonSnapshot = {
      status: "pending",
      update: {
        swap,
        sessionKey: SESSION,
        sequence: 1,
        confidence: 0.6,
        candidateId: "cand-a",
      },
    };
    const snap2: ComparisonSnapshot = {
      status: "ok",
      update: snap1.update,
      comparison: {
        delta: "100",
        percentage: 5,
        provider: "0x",
        routing: "uni-v3",
      },
    };
    const state = fold([
      { kind: "compare_snapshot", at: 1, snapshot: snap1 },
      { kind: "compare_snapshot", at: 2, snapshot: snap2 },
    ]);
    expect(state.compareBySession.get(SESSION)).toEqual(snap2);
  });
});

describe("reduceDebugStream: templates", () => {
  it("attaches extractions to the matching evaluation on template_match", () => {
    const state = fold([
      {
        kind: "template_eval",
        at: 1,
        templateId: "uniswap",
        interceptedId: "evt-1",
        result: "no_match",
        failedField: "tokenOut",
      },
      {
        kind: "template_eval",
        at: 2,
        templateId: "uniswap",
        interceptedId: "evt-2",
        result: "match",
      },
      {
        kind: "template_match",
        at: 3,
        templateId: "uniswap",
        interceptedId: "evt-2",
        extractions: { tokenOut: "0xbbb" },
        swap,
      },
    ]);
    const row = state.templates.get("uniswap");
    expect(row?.evaluations).toHaveLength(2);
    expect(row?.evaluations[0]?.extractions).toBeUndefined();
    expect(row?.evaluations[1]?.extractions).toEqual({ tokenOut: "0xbbb" });
  });
});

describe("reduceDebugStream: heuristics", () => {
  it("attaches extractions to the matching row on heuristic_match", () => {
    const state = fold([
      {
        kind: "heuristic_eval",
        at: 1,
        interceptedId: "evt-1",
        signal: "shape",
        matched: false,
        reason: "no buyAmount",
      },
      {
        kind: "heuristic_eval",
        at: 2,
        interceptedId: "evt-2",
        signal: "shape",
        matched: true,
      },
      {
        kind: "heuristic_match",
        at: 3,
        interceptedId: "evt-2",
        extractions: { tokenOut: "0xbbb" },
        swap,
      },
    ]);
    expect(state.heuristics).toHaveLength(2);
    expect(state.heuristics[0]?.extractions).toBeUndefined();
    expect(state.heuristics[1]?.extractions).toEqual({ tokenOut: "0xbbb" });
  });
});
