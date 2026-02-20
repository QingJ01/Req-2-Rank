import { appStore } from "./state.js";

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
  const calibrations = await appStore.listCalibrations(5);

  return (
    <section>
      <h1>Leaderboard</h1>
      <p className="hub-muted">Community-submitted model scores with verification status support.</p>
      <div className="hub-card" style={{ overflow: "hidden" }}>
        <table className="hub-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Model</th>
              <th>Score</th>
              <th>CI95</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={`${entry.model}-${entry.rank}`}>
                <td>{entry.rank}</td>
                <td>{entry.model}</td>
                <td>{entry.score.toFixed(1)}</td>
                <td>[{(entry.ci95?.[0] ?? entry.score).toFixed(1)}, {(entry.ci95?.[1] ?? entry.score).toFixed(1)}]</td>
                <td>
                  <span
                    className="hub-pill"
                    style={{ backgroundColor: statusBadgeColor(entry.verificationStatus) }}
                  >
                    {entry.verificationStatus ?? "pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 20 }}>Calibration Recommendations</h2>
      <div className="hub-card" style={{ overflow: "hidden" }}>
        <table className="hub-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Recommended</th>
              <th>Average Score</th>
              <th>Sample Size</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {calibrations.length === 0 ? (
              <tr>
                <td colSpan={5} className="hub-muted">
                  No calibration snapshots yet.
                </td>
              </tr>
            ) : (
              calibrations.map((item) => (
                <tr key={item.id}>
                  <td>{item.createdAt}</td>
                  <td>{item.recommendedComplexity}</td>
                  <td>{item.averageScore.toFixed(1)}</td>
                  <td>{item.sampleSize}</td>
                  <td>{item.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
