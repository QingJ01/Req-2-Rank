import { CiChart } from "../../components/ci-chart.client.js";
import { MiniTrend } from "../../components/mini-trend.client.js";
import { RadarChart } from "../../components/radar-chart.client.js";
import { DIMENSION_KEYS, safeScore, statusBadgeClass, statusLabel } from "../../components/viz-utils.js";
import { resolveLang } from "../../i18n.js";
import { appStore } from "../../state.js";

type ModelPageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    lang?: string;
  };
};

export default async function ModelPage({ params, searchParams }: ModelPageProps) {
  const lang = resolveLang(searchParams?.lang);
  const isEn = lang === "en";
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
      <h1>{isEn ? "Model Detail" : "模型详情"}</h1>
      <p className="hub-muted">{model}</p>

      <div className="hub-grid cols-2" style={{ marginBottom: 18 }}>
        <div className="hub-card" style={{ padding: 14 }}>
          <div className="hub-muted">{isEn ? "Submissions" : "提交次数"}</div>
          <strong>{submissions.length}</strong>
        </div>
        <div className="hub-card" style={{ padding: 14 }}>
          <div className="hub-muted">{isEn ? "Best Score" : "最高分"}</div>
          <strong>
            {submissions.length > 0 ? Math.max(...submissions.map((item) => item.score)).toFixed(1) : "-"}
          </strong>
        </div>
      </div>

      <ul className="hub-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {submissions.map((item, index) => (
          <li key={item.runId} className="hub-card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <strong>{item.runId}</strong>
                <div className="hub-muted">
                  {isEn ? "score" : "得分"} {item.score.toFixed(1)} · {new Date(item.submittedAt).toLocaleString()}
                </div>
              </div>
              <span className={statusBadgeClass(item.verificationStatus)}>{statusLabel(item.verificationStatus, lang)}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <MiniTrend points={submissions.slice(index).reverse().map((entry) => entry.score)} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hub-grid cols-2" style={{ marginTop: 20 }}>
        <article className="hub-card" style={{ padding: 12 }}>
          <h2>{isEn ? "Radar (average dimensions)" : "维度雷达图（平均）"}</h2>
          <RadarChart values={radarValues} lang={lang} />
          {latest ? <p className="hub-muted">{isEn ? `Latest run: ${latest.runId}` : `最近一次运行：${latest.runId}`}</p> : null}
        </article>

        <article className="hub-card" style={{ padding: 12 }}>
          <h2>{isEn ? "Score trend with CI" : "得分趋势与置信区间"}</h2>
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
