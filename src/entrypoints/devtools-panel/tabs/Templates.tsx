import type {
  DebugStream,
  TemplateEvaluationRow,
} from "../use-debug-stream";

type Props = { stream: DebugStream };

/**
 * Tree view of registered templates and their evaluation history. Templates
 * sort by most-recent `loadedAt`; un-loaded templates (only seen via
 * `template_eval` without a prior `template_loaded`) sink to the bottom. Per
 * template we cap the visible eval list at the most recent 20 to keep the
 * panel light — older evals stay in `stream.events` for raw inspection.
 */
export function Templates({ stream }: Props) {
  const rows = [...stream.templates.values()].sort(
    (a, b) => (b.loadedAt ?? 0) - (a.loadedAt ?? 0),
  );
  if (rows.length === 0) {
    return <p>No templates evaluated yet.</p>;
  }
  return (
    <ul>
      {rows.map((t) => {
        const matches = t.evaluations.filter((e) => e.result === "match")
          .length;
        return (
          <li key={t.templateId}>
            <details>
              <summary>
                {t.templateId}
                {t.version ? ` (${t.version})` : ""} — {t.evaluations.length}{" "}
                evals, {matches} matches
                {t.hostMatch ? ` · host ${t.hostMatch}` : ""}
              </summary>
              <TemplateEvalList evaluations={t.evaluations} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function TemplateEvalList({
  evaluations,
}: {
  evaluations: TemplateEvaluationRow[];
}) {
  if (evaluations.length === 0) {
    return <p>no evals yet</p>;
  }
  const recent = evaluations.slice(-20).reverse();
  return (
    <ul>
      {recent.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          {new Date(e.at).toLocaleTimeString()} ·{" "}
          {e.interceptedId.slice(0, 12)}… ·{" "}
          {e.result === "match"
            ? "match"
            : `no_match (${e.failedField ?? "?"})`}
          {e.extractions ? (
            <pre>{JSON.stringify(e.extractions, null, 2)}</pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
