import { cookies } from "next/headers";
import Link from "next/link";
import { MiniTrend } from "./components/mini-trend.client";
import { statusBadgeClass, statusLabel } from "./components/viz-utils";
import { resolveLang } from "./i18n";
import { resolveLeaderboardStrategy } from "../lib/leaderboard-strategy";
import { appStore } from "./state";
import { t } from "./locales";

type LeaderboardPageProps = {
  searchParams?: {
    strategy?: string;
  };
};

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps = {}) {
  const cookieStore = await cookies();
  const lang = resolveLang(cookieStore.get("hub.lang")?.value);
  const strategy = resolveLeaderboardStrategy(searchParams?.strategy);
  const entries = await appStore.listLeaderboard({ limit: 30, offset: 0, sort: "desc", strategy });
  const calibrations = await appStore.listCalibrations(5);

  const trendModels = entries.slice(0, 5).map((item) => item.model);
  const modelSubmissions = await Promise.all(trendModels.map((model) => appStore.listModelSubmissions(model)));
  const trendByModel = Object.fromEntries(
    modelSubmissions.map((submissions, index) => [trendModels[index], submissions.slice().reverse().map((item) => item.score)])
  );

  return (
    <section>
      <div className="hub-hero-panel">
        <div className="hub-hero-text">
          <h1 className="hub-hero-title">{t(lang, "leaderboard")}</h1>
          <p className="hub-hero-desc">{t(lang, "leaderboardDesc")}</p>
        </div>
      </div>

      <div className="hub-card" style={{ padding: "24px 0" }}>
        <div style={{ padding: "0 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.25rem", margin: 0 }}>{t(lang, "models")}</h2>
          <div className="hub-segmented-controls">
            <Link className={`hub-segment-item ${strategy === "mean" ? "active" : ""}`} href="/?strategy=mean">
              {t(lang, "mean")}
            </Link>
            <Link className={`hub-segment-item ${strategy === "best" ? "active" : ""}`} href="/?strategy=best">
              {t(lang, "best")}
            </Link>
            <Link className={`hub-segment-item ${strategy === "latest" ? "active" : ""}`} href="/?strategy=latest">
              {t(lang, "latest")}
            </Link>
          </div>
        </div>
        <div className="hub-table-wrap">
          <table className="hub-table">
            <thead>
              <tr>
                <th>{t(lang, "rank")}</th>
                <th>{t(lang, "model")}</th>
                <th>{t(lang, "score")}</th>
                <th>CI95</th>
                <th>{t(lang, "verification")}</th>
                <th>{t(lang, "trend")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const rankClass = index < 3 ? `hub-top-${index + 1}` : "";
                return (
                  <tr key={`${entry.model}-${entry.rank}`} className={rankClass}>
                    <td>{entry.rank}</td>
                    <td>
                      <Link href={`/model/${encodeURIComponent(entry.model)}`}>{entry.model}</Link>
                    </td>
                    <td>{entry.score.toFixed(1)}</td>
                    <td>[{(entry.ci95?.[0] ?? entry.score).toFixed(1)}, {(entry.ci95?.[1] ?? entry.score).toFixed(1)}]</td>
                    <td>
                      <span className={statusBadgeClass(entry.verificationStatus)}>
                        {statusLabel(entry.verificationStatus, lang)}
                      </span>
                    </td>
                    <td>
                      <MiniTrend points={trendByModel[entry.model] ?? []} lang={lang} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: "48px", opacity: 0.8, transform: "scale(0.98)", transformOrigin: "top left" }}>
        <h2 className="hub-muted" style={{ fontSize: "1.125rem", marginBottom: "16px" }}>
          {t(lang, "calibrationTitle")}
        </h2>
        <div className="hub-card hub-table-wrap" style={{ border: "1px dashed var(--border-light)", boxShadow: "none" }}>
          <table className="hub-table">
            <thead>
              <tr>
                <th>{t(lang, "calibrationTime")}</th>
                <th>{t(lang, "calibrationComplexity")}</th>
                <th>{t(lang, "calibrationAvgScore")}</th>
                <th>{t(lang, "calibrationSampleSize")}</th>
                <th>{t(lang, "calibrationReason")}</th>
              </tr>
            </thead>
            <tbody>
              {calibrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="hub-muted">
                    {t(lang, "calibrationEmpty")}
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
      </div>
    </section>
  );
}
