import type { DebugStream } from "../use-debug-stream";

type Props = { stream: DebugStream };

/**
 * Flat newest-first list of heuristic evaluations. Capped at 50 visible rows
 * — the alias-scan fallback fires on a lot of fetch/XHR traffic so older
 * entries get aged out of the panel view (they remain in `stream.events`).
 */
export function Heuristics({ stream }: Props) {
  const rows = stream.heuristics.slice(-50).reverse();
  if (rows.length === 0) {
    return <p>No heuristic evaluations yet.</p>;
  }
  return (
    <ul>
      {rows.map((r, i) => (
        <li key={`${r.at}-${r.interceptedId}-${i}`}>
          <details>
            <summary>
              {new Date(r.at).toLocaleTimeString()} ·{" "}
              {r.interceptedId.slice(0, 12)}… ·{" "}
              {r.matched ? "match" : `no_match (${r.reason ?? "?"})`}
            </summary>
            {r.matched && r.extractions ? (
              <pre>{JSON.stringify(r.extractions, null, 2)}</pre>
            ) : null}
          </details>
        </li>
      ))}
    </ul>
  );
}
