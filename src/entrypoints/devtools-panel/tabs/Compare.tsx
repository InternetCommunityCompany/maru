import type { ComparisonSnapshot } from "@/comparison/types";
import type { DebugStream } from "../use-debug-stream";

type Props = { stream: DebugStream };

type OkSnapshot = Extract<ComparisonSnapshot, { status: "ok" }>;

/**
 * Side-by-side dapp-vs-Maru-API table for every session that has produced a
 * comparison snapshot. Sessions render newest first by snapshot insertion
 * order; we don't time-stamp snapshots, so we just iterate the map.
 */
export function Compare({ stream }: Props) {
  const cards = [...stream.compareBySession.values()];
  if (cards.length === 0) {
    return <p>No comparison snapshots yet.</p>;
  }
  return (
    <div>
      {cards.map((snap) => (
        <CompareCard key={snap.update.sessionKey} snapshot={snap} />
      ))}
    </div>
  );
}

function CompareCard({
  snapshot,
}: {
  snapshot: ComparisonSnapshot;
}) {
  const { update } = snapshot;
  const ok = snapshot.status === "ok" ? snapshot : null;
  return (
    <article>
      <h3>session {update.sessionKey.slice(0, 8)}…</h3>
      <p>
        chainIn {update.swap.chainIn} → chainOut {update.swap.chainOut} ·
        amountIn {update.swap.amountIn}
      </p>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>dapp</th>
            <th>Maru API</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>buyToken</td>
            <td>{update.swap.tokenOut.slice(0, 10)}…</td>
            <td>{update.swap.tokenOut.slice(0, 10)}…</td>
          </tr>
          <tr>
            <td>buyAmount</td>
            <td>{update.swap.amountOut}</td>
            <td>{ok ? formatBackendAmount(ok) : "—"}</td>
          </tr>
          <tr>
            <td>provider</td>
            <td>{update.swap.templateId}</td>
            <td>{ok ? ok.comparison.provider : "—"}</td>
          </tr>
          <tr>
            <td>routing</td>
            <td>—</td>
            <td>{ok ? (ok.comparison.routing ?? "—") : "—"}</td>
          </tr>
          <tr>
            <td>status</td>
            <td>winning candidate</td>
            <td>{snapshot.status}</td>
          </tr>
        </tbody>
      </table>
      {ok && <p>winner: {determineWinner(ok)}</p>}
    </article>
  );
}

function formatBackendAmount(snapshot: OkSnapshot): string {
  const { delta, percentage } = snapshot.comparison;
  const sign = delta.startsWith("-") ? "" : "+";
  return `Δ ${sign}${delta}${
    percentage !== null ? ` (${percentage.toFixed(2)}%)` : ""
  }`;
}

function determineWinner(snapshot: OkSnapshot): string {
  // `delta > 0` means the backend amountOut beat the dapp's — Maru wins.
  return BigInt(snapshot.comparison.delta) > 0n ? "Maru" : "dapp";
}
