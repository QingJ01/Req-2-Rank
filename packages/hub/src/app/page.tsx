import { MiniTrend } from "./components/mini-trend.client.js";
import { RadarChart } from "./components/radar-chart.client.js";
import { DIMENSIONS, statusBadgeClass } from "./components/viz-utils.js";
import { appStore } from "./state.js";

export default async function LeaderboardPage() {
  const entries = await appStore.listLeaderboard({ limit: 30, offset: 0, sort: "desc" });
  const calibrations = await appStore.listCalibrations(5);

  const trendModels = entries.slice(0, 10).map((item) => item.model);
  const modelSubmissions = await Promise.all(trendModels.map((model) => appStore.listModelSubmissions(model)));
  const trendByModel = Object.fromEntries(
    modelSubmissions.map((submissions, index) => [trendModels[index], submissions.slice().reverse().map((item) => item.score)])
  );

  const topModelSubmissions = modelSubmissions[0] ?? [];
  const radarValues = Object.fromEntries(
    DIMENSIONS.map((dimension) => {
      const values = topModelSubmissions.map((submission) => submission.dimensionScores[dimension.key] ?? 0);
      const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return [dimension.key, average];
    })
  );

  return (
    <section>
      <h1>Leaderboard</h1>
      <p className="hub-muted">Community-submitted model scores with verification status support.</p>
      <div className="hub-grid cols-2">
        <div className="hub-card" style={{ overflow: "hidden" }}>
          <table className="hub-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Model</th>
                <th>Score</th>
                <th>CI95</th>
                <th>Verification</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.model}-${entry.rank}`}>
                  <td>{entry.rank}</td>
                  <td>
                    <a href={`/model/${encodeURIComponent(entry.model)}`}>{entry.model}</a>
                  </td>
                  <td>{entry.score.toFixed(1)}</td>
                  <td>[{(entry.ci95?.[0] ?? entry.score).toFixed(1)}, {(entry.ci95?.[1] ?? entry.score).toFixed(1)}]</td>
                  <td>
                    <span className={statusBadgeClass(entry.verificationStatus)}>
                      {entry.verificationStatus ?? "pending"}
                    </span>
                  </td>
                  <td>
                    <MiniTrend points={trendByModel[entry.model] ?? []} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <article className="hub-card" style={{ padding: 12 }}>
          <h2>Dimension Radar</h2>
          <RadarChart values={radarValues} />
          <p className="hub-muted" style={{ marginTop: 8 }}>
            Average dimension scores for {entries[0]?.model ?? "top model"} recent submissions.
          </p>
        </article>
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
