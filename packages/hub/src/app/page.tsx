import { MiniTrend } from "./components/mini-trend.client.js";
import { RadarChart } from "./components/radar-chart.client.js";
import { DIMENSION_KEYS, statusBadgeClass, statusLabel } from "./components/viz-utils.js";
import { localizePath, resolveLang } from "./i18n.js";
import { resolveLeaderboardStrategy } from "../lib/leaderboard-strategy.js";
import { appStore } from "./state.js";

type LeaderboardPageProps = {
  searchParams?: {
    lang?: string;
    strategy?: string;
  };
};

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps = {}) {
  const lang = resolveLang(searchParams?.lang);
  const isEn = lang === "en";
  const strategy = resolveLeaderboardStrategy(searchParams?.strategy);
  const entries = await appStore.listLeaderboard({ limit: 30, offset: 0, sort: "desc", strategy });
  const calibrations = await appStore.listCalibrations(5);

  const trendModels = entries.slice(0, 10).map((item) => item.model);
  const modelSubmissions = await Promise.all(trendModels.map((model) => appStore.listModelSubmissions(model)));
  const trendByModel = Object.fromEntries(
    modelSubmissions.map((submissions, index) => [trendModels[index], submissions.slice().reverse().map((item) => item.score)])
  );

  const topModelSubmissions = modelSubmissions[0] ?? [];
  const radarValues = Object.fromEntries(
    DIMENSION_KEYS.map((dimensionKey) => {
      const values = topModelSubmissions.map((submission) => submission.dimensionScores[dimensionKey] ?? 0);
      const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return [dimensionKey, average];
    })
  );

  return (
    <section>
      <h1>{isEn ? "Leaderboard" : "排行榜"}</h1>
      <p className="hub-muted">{isEn ? "Community model scores and verification states." : "展示社区提交模型的得分与验证状态。"}</p>
      <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="hub-muted">{isEn ? "Aggregation" : "聚合策略"}:</span>
        <a className={strategy === "mean" ? "hub-nav-lang active" : "hub-nav-lang"} href={`/?lang=${lang}&strategy=mean`}>
          {isEn ? "Mean" : "均值"}
        </a>
        <a className={strategy === "best" ? "hub-nav-lang active" : "hub-nav-lang"} href={`/?lang=${lang}&strategy=best`}>
          {isEn ? "Best" : "最佳"}
        </a>
        <a className={strategy === "latest" ? "hub-nav-lang active" : "hub-nav-lang"} href={`/?lang=${lang}&strategy=latest`}>
          {isEn ? "Latest" : "最近"}
        </a>
      </div>
      <div className="hub-grid cols-2">
        <div className="hub-card" style={{ overflow: "hidden" }}>
          <table className="hub-table">
            <thead>
              <tr>
                <th>{isEn ? "Rank" : "排名"}</th>
                <th>{isEn ? "Model" : "模型"}</th>
                <th>{isEn ? "Score" : "得分"}</th>
                <th>CI95</th>
                <th>{isEn ? "Verification" : "验证状态"}</th>
                <th>{isEn ? "Trend" : "趋势"}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.model}-${entry.rank}`}>
                  <td>{entry.rank}</td>
                  <td>
                    <a href={localizePath(`/model/${encodeURIComponent(entry.model)}`, lang)}>{entry.model}</a>
                  </td>
                  <td>{entry.score.toFixed(1)}</td>
                  <td>[{(entry.ci95?.[0] ?? entry.score).toFixed(1)}, {(entry.ci95?.[1] ?? entry.score).toFixed(1)}]</td>
                  <td>
                    <span className={statusBadgeClass(entry.verificationStatus)}>
                      {statusLabel(entry.verificationStatus, lang)}
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
          <h2>{isEn ? "Dimension Radar" : "维度雷达图"}</h2>
          <RadarChart values={radarValues} lang={lang} />
          <p className="hub-muted" style={{ marginTop: 8 }}>
            {isEn
              ? `Average dimension scores for recent submissions of ${entries[0]?.model ?? "the top model"}.`
              : `${entries[0]?.model ?? "当前模型"} 近期提交的维度均值。`}
          </p>
        </article>
      </div>

      <h2 style={{ marginTop: 20 }}>{isEn ? "Calibration Recommendations" : "校准建议"}</h2>
      <div className="hub-card" style={{ overflow: "hidden" }}>
        <table className="hub-table">
          <thead>
            <tr>
               <th>{isEn ? "Time" : "时间"}</th>
               <th>{isEn ? "Recommended Complexity" : "推荐复杂度"}</th>
               <th>{isEn ? "Average Score" : "平均得分"}</th>
               <th>{isEn ? "Sample Size" : "样本数"}</th>
               <th>{isEn ? "Reason" : "原因"}</th>
            </tr>
          </thead>
          <tbody>
            {calibrations.length === 0 ? (
              <tr>
                <td colSpan={5} className="hub-muted">
                  {isEn ? "No calibration snapshots yet." : "暂无校准快照。"}
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
