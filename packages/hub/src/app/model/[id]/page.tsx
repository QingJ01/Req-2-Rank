import { cookies } from "next/headers";
import { CiChart } from "../../components/ci-chart.client";
import { MiniTrend } from "../../components/mini-trend.client";
import { RadarChart } from "../../components/radar-chart.client";
import { DIMENSION_KEYS, safeScore, statusBadgeClass, statusLabel } from "../../components/viz-utils";
import { resolveLang } from "../../i18n";
import { appStore } from "../../state";
import { t } from "../../locales";

type ModelPageProps = {
  params: {
    id: string;
  };
};

export default async function ModelPage({ params }: ModelPageProps) {
  const cookieStore = await cookies();
  const lang = resolveLang(cookieStore.get("hub.lang")?.value);
  const model = decodeURIComponent(params.id);
  const submissions = await appStore.listModelSubmissions(model);
  const latest = submissions[0];
  const radarValues = Object.fromEntries(
    DIMENSION_KEYS.map((dimensionKey) => {
      const values = submissions.map((item) => safeScore(item.dimensionScores[dimensionKey]));
      const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return [dimensionKey, average];
    })
  );

  return (
    <section>
      <h1>{t(lang, "modelDetail")}</h1>
      <p className="hub-muted">{model}</p>

      <div className="hub-grid cols-2 hub-mb">
        <div className="hub-card hub-card-padded">
          <div className="hub-muted">{t(lang, "submissions")}</div>
          <strong>{submissions.length}</strong>
        </div>
        <div className="hub-card hub-card-padded">
          <div className="hub-muted">{t(lang, "bestScore")}</div>
          <strong>
            {submissions.length > 0 ? Math.max(...submissions.map((item) => item.score)).toFixed(1) : "-"}
          </strong>
        </div>
      </div>

      <ul className="hub-grid hub-list-reset">
        {submissions.map((item, index) => (
          <li key={item.runId} className="hub-card hub-card-padded">
            <div className="hub-flex-between">
              <div>
                <strong>{item.runId}</strong>
                <div className="hub-muted">
                  {t(lang, "score")} {item.score.toFixed(1)} · {new Date(item.submittedAt).toLocaleString()}
                </div>
              </div>
              <span className={statusBadgeClass(item.verificationStatus)}>{statusLabel(item.verificationStatus, lang)}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <MiniTrend points={submissions.slice(index).reverse().map((entry) => entry.score)} lang={lang} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hub-grid cols-2 hub-mt">
        <article className="hub-card hub-card-padded">
          <h2>{t(lang, "radarAvgTitle")}</h2>
          <RadarChart values={radarValues} lang={lang} />
          {latest ? <p className="hub-muted">{lang === "en" ? `Latest run: ${latest.runId}` : `最近一次运行：${latest.runId}`}</p> : null}
        </article>

        <article className="hub-card hub-card-padded">
          <h2>{t(lang, "scoreTrendCi")}</h2>
          <CiChart submissions={submissions} lang={lang} />
          <div className="hub-muted">
            {submissions.slice(0, 3).map((item) => (
              <div key={`${item.runId}-ci`}>{item.runId}: CI95 [{item.ci95[0].toFixed(1)}, {item.ci95[1].toFixed(1)}]</div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
