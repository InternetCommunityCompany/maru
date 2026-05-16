import { useState } from "react";
import type { SessionKey } from "@/arbiter/types";
import type { DebugStream, SessionView, WinnerFlip } from "../use-debug-stream";

type Props = { stream: DebugStream };

/**
 * Sessions sidebar + per-session candidate table and winner-flip strip.
 * The active session defaults to the most recently opened — clicking a
 * sidebar row pins a different one.
 */
export function Arbiter({ stream }: Props) {
  const ordered = [...stream.sessions.values()].sort(
    (a, b) => b.openedAt - a.openedAt,
  );
  const [selected, setSelected] = useState<SessionKey | null>(null);
  const active =
    selected !== null
      ? (stream.sessions.get(selected) ?? ordered[0])
      : ordered[0];

  if (ordered.length === 0) {
    return <p>No sessions yet. Open a dapp and trigger a quote.</p>;
  }

  return (
    <div>
      <aside>
        <h3>Sessions</h3>
        <ul>
          {ordered.slice(0, 6).map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setSelected(s.key)}
                data-active={s === active || undefined}
              >
                {s.domain} · {new Date(s.openedAt).toLocaleTimeString()}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {active && <SessionDetail session={active} />}
    </div>
  );
}

function SessionDetail({ session }: { session: SessionView }) {
  return (
    <main>
      <header>
        <h2>session {session.key.slice(0, 8)}…</h2>
        <p>
          domain: {session.domain} · opened{" "}
          {new Date(session.openedAt).toLocaleTimeString()} · seq{" "}
          {session.lastSequence} · confidence{" "}
          {session.lastConfidence.toFixed(2)}
        </p>
        <WinnerStrip
          history={session.winnerHistory}
          openedAt={session.openedAt}
        />
      </header>
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>prov</th>
            <th>phase</th>
            <th>rank</th>
            <th>ground</th>
            <th>total</th>
            <th>winner</th>
          </tr>
        </thead>
        <tbody>
          {session.candidates.map((c) => (
            <tr key={c.candidateId}>
              <td>{c.candidateId.slice(0, 16)}…</td>
              <td>{c.breakdown?.provenance.toFixed(2) ?? "—"}</td>
              <td>{c.breakdown?.phase.toFixed(2) ?? "—"}</td>
              <td>{c.breakdown?.rank.toFixed(3) ?? "—"}</td>
              <td>{c.breakdown?.grounding.toFixed(2) ?? "—"}</td>
              <td>{c.breakdown?.total.toFixed(3) ?? "—"}</td>
              <td>{session.bestCandidateId === c.candidateId ? "★" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function WinnerStrip({
  history,
  openedAt,
}: {
  history: WinnerFlip[];
  openedAt: number;
}) {
  if (history.length === 0) return <p>no winner flips yet</p>;
  return (
    <ol>
      {history.map((h, i) => (
        <li key={`${h.at}-${i}`}>
          +{h.at - openedAt}ms → {h.nextId.slice(0, 16)}… (score{" "}
          {h.score.toFixed(3)})
        </li>
      ))}
    </ol>
  );
}
