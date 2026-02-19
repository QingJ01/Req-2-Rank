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
      <h1 style={{ marginTop: 0, fontSize: 32 }}>Model Detail</h1>
      <p style={{ marginTop: 0, color: "#4e5566" }}>{model}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
        <div style={{ padding: 14, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.75)", border: "1px solid rgba(31,36,48,0.1)" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Submissions</div>
          <strong style={{ fontSize: 24 }}>{submissions.length}</strong>
        </div>
        <div style={{ padding: 14, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.75)", border: "1px solid rgba(31,36,48,0.1)" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Best Score</div>
          <strong style={{ fontSize: 24 }}>
            {submissions.length > 0 ? Math.max(...submissions.map((item) => item.score)).toFixed(1) : "-"}
          </strong>
        </div>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {submissions.map((item) => (
          <li
            key={item.runId}
            style={{
              padding: 12,
              borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(31,36,48,0.1)"
            }}
          >
            <strong>{item.runId}</strong>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              score {item.score.toFixed(1)} · status {item.verificationStatus} · {item.submittedAt}
            </div>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 20, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        <article style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(31,36,48,0.1)", borderRadius: 12, padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Radar (latest dimensions)</h2>
          <svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="dimension radar">
            <circle cx="120" cy="120" r="95" fill="none" stroke="rgba(31,36,48,0.12)" />
            <polygon points={radarPoints} fill="rgba(57,112,196,0.35)" stroke="#2b5da9" strokeWidth="2" />
          </svg>
        </article>

        <article style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(31,36,48,0.1)", borderRadius: 12, padding: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Score trend with CI</h2>
          <svg width="240" height="140" viewBox="0 0 240 140" role="img" aria-label="score trend">
            <line x1="10" y1="120" x2="230" y2="120" stroke="rgba(31,36,48,0.2)" />
            <polyline fill="none" stroke="#2b5da9" strokeWidth="2" points={trendPoints} />
          </svg>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {submissions.slice(0, 3).map((item) => (
              <div key={`${item.runId}-ci`}>{item.runId}: CI95 [{item.ci95[0].toFixed(1)}, {item.ci95[1].toFixed(1)}]</div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
