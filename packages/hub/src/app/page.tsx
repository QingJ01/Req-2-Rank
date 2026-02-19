import { appStore } from "./state.js";
import type { CSSProperties } from "react";

const tableCell: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(31,36,48,0.1)",
  fontSize: 14
};

function statusBadgeColor(status: string | undefined): string {
  if (status === "verified") {
    return "#1f7a4d";
  }
  if (status === "disputed") {
    return "#9a3b3b";
  }
  return "#9a7b2d";
}

export default async function LeaderboardPage() {
  const entries = await appStore.listLeaderboard({ limit: 30, offset: 0, sort: "desc" });

  return (
    <section>
      <h1 style={{ marginTop: 0, fontSize: 34, letterSpacing: "0.02em" }}>Leaderboard</h1>
      <p style={{ marginTop: 0, color: "#4e5566" }}>Community-submitted model scores with verification status support.</p>
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(31,36,48,0.14)",
          backgroundColor: "rgba(255,255,255,0.72)",
          boxShadow: "0 14px 36px rgba(29,48,77,0.12)"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.92)" }}>
              <th style={{ ...tableCell, textAlign: "left", fontSize: 12, textTransform: "uppercase" }}>Rank</th>
              <th style={{ ...tableCell, textAlign: "left", fontSize: 12, textTransform: "uppercase" }}>Model</th>
              <th style={{ ...tableCell, textAlign: "left", fontSize: 12, textTransform: "uppercase" }}>Score</th>
              <th style={{ ...tableCell, textAlign: "left", fontSize: 12, textTransform: "uppercase" }}>CI95</th>
              <th style={{ ...tableCell, textAlign: "left", fontSize: 12, textTransform: "uppercase" }}>Verification</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={`${entry.model}-${entry.rank}`}>
                <td style={tableCell}>{entry.rank}</td>
                <td style={tableCell}>{entry.model}</td>
                <td style={tableCell}>{entry.score.toFixed(1)}</td>
                <td style={tableCell}>[{(entry.ci95?.[0] ?? entry.score).toFixed(1)}, {(entry.ci95?.[1] ?? entry.score).toFixed(1)}]</td>
                <td style={tableCell}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 9px",
                      borderRadius: 999,
                      color: "white",
                      fontSize: 12,
                      backgroundColor: statusBadgeColor(entry.verificationStatus)
                    }}
                  >
                    {entry.verificationStatus ?? "pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
