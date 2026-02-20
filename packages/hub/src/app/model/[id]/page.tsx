import { appStore } from "../../state.js";

type ModelPageProps = {
  params: {
    id: string;
  };
};

export default async function ModelPage({ params }: ModelPageProps) {
  const model = decodeURIComponent(params.id);
  const submissions = await appStore.listModelSubmissions(model);
  const latest = submissions[0];
  const dimensions = ["functionalCompleteness", "codeQuality", "logicAccuracy", "security", "engineeringPractice"] as const;
  const radarPoints = dimensions
    .map((dimension, index) => {
      const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
      const value = latest?.dimensionScores?.[dimension] ?? 0;
      const radius = 45 + value * 0.55;
      const x = 120 + Math.cos(angle) * radius;
      const y = 120 + Math.sin(angle) * radius;
      return `${x},${y}`;
    })
    .join(" ");

  const trendPoints = submissions
    .slice()
    .reverse()
    .map((item, index, list) => {
      const x = list.length <= 1 ? 10 : 10 + (index * 220) / (list.length - 1);
      const y = 120 - item.score;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section>
      <h1>Model Detail</h1>
      <p className="hub-muted">{model}</p>

      <div className="hub-grid cols-2" style={{ marginBottom: 18 }}>
        <div className="hub-card" style={{ padding: 14 }}>
          <div className="hub-muted">Submissions</div>
          <strong>{submissions.length}</strong>
        </div>
        <div className="hub-card" style={{ padding: 14 }}>
          <div className="hub-muted">Best Score</div>
          <strong>
            {submissions.length > 0 ? Math.max(...submissions.map((item) => item.score)).toFixed(1) : "-"}
          </strong>
        </div>
      </div>

      <ul className="hub-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {submissions.map((item) => (
          <li key={item.runId} className="hub-card" style={{ padding: 12 }}>
            <strong>{item.runId}</strong>
            <div className="hub-muted">
              score {item.score.toFixed(1)} · status {item.verificationStatus} · {item.submittedAt}
            </div>
          </li>
        ))}
      </ul>

      <div className="hub-grid cols-2" style={{ marginTop: 20 }}>
        <article className="hub-card" style={{ padding: 12 }}>
          <h2>Radar (latest dimensions)</h2>
          <svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="dimension radar">
            <circle cx="120" cy="120" r="95" fill="none" stroke="rgba(31,36,48,0.12)" />
            <polygon points={radarPoints} fill="rgba(57,112,196,0.35)" stroke="#2b5da9" strokeWidth="2" />
          </svg>
        </article>

        <article className="hub-card" style={{ padding: 12 }}>
          <h2>Score trend with CI</h2>
          <svg width="240" height="140" viewBox="0 0 240 140" role="img" aria-label="score trend">
            <line x1="10" y1="120" x2="230" y2="120" stroke="rgba(31,36,48,0.2)" />
            <polyline fill="none" stroke="#2b5da9" strokeWidth="2" points={trendPoints} />
          </svg>
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
