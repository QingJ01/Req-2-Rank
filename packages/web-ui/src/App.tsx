import { useEffect, useMemo, useState } from "react";

type Row = {
  rank: number;
  model: string;
  score: number;
  ci95?: [number, number];
  verificationStatus?: string;
};

export function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/leaderboard?limit=20")
      .then((res) => res.json() as Promise<{ data?: Row[]; error?: { message?: string } }>)
      .then((payload) => {
        if (cancelled) return;
        if (payload.data) {
          setRows(payload.data);
          return;
        }
        setError(payload.error?.message ?? "Failed to load leaderboard");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const top = useMemo(() => rows[0], [rows]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #fefcf6, #eef7ff)",
        color: "#1f2430",
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        padding: 24
      }}
    >
      <h1 style={{ marginTop: 0 }}>Req2Rank Local Web UI</h1>
      {top ? <p>Top model: {top.model} ({top.score.toFixed(1)})</p> : <p>No leaderboard data yet.</p>}
      {error ? <p style={{ color: "#9a3b3b" }}>{error}</p> : null}

      <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(255,255,255,0.8)", borderRadius: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Rank</th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Model</th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Score</th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>CI95</th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.model}-${row.rank}`}>
              <td style={{ padding: 10 }}>{row.rank}</td>
              <td style={{ padding: 10 }}>{row.model}</td>
              <td style={{ padding: 10 }}>{row.score.toFixed(1)}</td>
              <td style={{ padding: 10 }}>{row.ci95 ? `[${row.ci95[0].toFixed(1)}, ${row.ci95[1].toFixed(1)}]` : "-"}</td>
              <td style={{ padding: 10 }}>{row.verificationStatus ?? "pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
