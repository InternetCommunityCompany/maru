import type {
  CandidatePhase,
  ScoreBreakdown,
  SessionKey,
  SessionPartialKey,
} from "@/arbiter/types";
import type { ComparisonSnapshot } from "@/comparison/types";
import type { SwapEvent } from "@/template-engine/build-swap-event";

/**
 * Trace event the swap-detection pipeline emits via `recordTrace`. Every
 * variant must be JSON-serializable end-to-end: no DOM nodes, no functions,
 * no class instances — the dev-only relay forwards these across the
 * MAIN-world / background boundary by structured clone.
 */
export type DebugEvent =
  | {
      kind: "template_loaded";
      at: number;
      templateId: string;
      version: string;
      hostMatch: string;
    }
  | {
      kind: "template_eval";
      at: number;
      templateId: string;
      interceptedId: string;
      result: "match" | "no_match";
      failedField?: string;
    }
  | {
      kind: "template_match";
      at: number;
      templateId: string;
      interceptedId: string;
      extractions: Record<string, unknown>;
      swap: SwapEvent;
    }
  | {
      kind: "heuristic_eval";
      at: number;
      interceptedId: string;
      signal: string;
      matched: boolean;
      reason?: string;
    }
  | {
      kind: "heuristic_match";
      at: number;
      interceptedId: string;
      extractions: Record<string, unknown>;
      swap: SwapEvent;
    }
  | {
      kind: "session_opened";
      at: number;
      sessionKey: SessionKey;
      domain: string;
      partialKey: SessionPartialKey;
    }
  | {
      kind: "candidate_added";
      at: number;
      sessionKey: SessionKey;
      candidateId: string;
      phase: CandidatePhase;
      source: string;
      templateId: string;
    }
  | {
      kind: "score_breakdown";
      at: number;
      sessionKey: SessionKey;
      candidateId: string;
      breakdown: ScoreBreakdown;
    }
  | {
      kind: "best_changed";
      at: number;
      sessionKey: SessionKey;
      previousId: string | null;
      nextId: string;
      score: number;
    }
  | {
      kind: "quote_emitted";
      at: number;
      sessionKey: SessionKey;
      sequence: number;
      candidateId: string;
      confidence: number;
    }
  | { kind: "compare_snapshot"; at: number; snapshot: ComparisonSnapshot };
