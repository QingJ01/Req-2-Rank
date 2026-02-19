import { appStore } from "../../state.js";
import { SampleCard } from "./sample-card.client.js";

type SubmissionPageProps = {
  params: {
    id: string;
  };
};

export default async function SubmissionPage({ params }: SubmissionPageProps) {
  const detail = await appStore.getSubmission(params.id);
  const dimensions = detail?.dimensionScores ? Object.entries(detail.dimensionScores) : [];
  const timeline = detail?.evidenceChain?.timeline ?? [];
  const samples = detail?.evidenceChain?.samples ?? [];
  const environment = detail?.evidenceChain?.environment;

  return (
    <section>
      <h1 style={{ marginTop: 0, fontSize: 32 }}>Submission Detail</h1>
      {!detail ? (
        <p style={{ color: "#4e5566" }}>Submission not found.</p>
      ) : (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(31,36,48,0.1)",
            lineHeight: 1.7
          }}
        >
          <div>
            <strong>Run ID:</strong> {detail.runId}
          </div>
          <div>
            <strong>Model:</strong> {detail.model}
          </div>
          <div>
            <strong>Score:</strong> {detail.score.toFixed(1)}
          </div>
          <div>
            <strong>Status:</strong> {detail.verificationStatus}
          </div>
          <div>
            <strong>Submitted:</strong> {detail.submittedAt}
          </div>

          <h2 style={{ fontSize: 18, marginTop: 14, marginBottom: 8 }}>Dimension Scores</h2>
          {dimensions.length === 0 ? (
            <div>Dimension scores unavailable.</div>
          ) : (
            <ul style={{ marginTop: 0, marginBottom: 0 }}>
              {dimensions.map(([key, value]) => (
                <li key={key}>
                  {key}: {value.toFixed(1)}
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ fontSize: 18, marginTop: 14, marginBottom: 8 }}>Evidence Chain</h2>
          <div>
            <strong>Timeline:</strong> {timeline.length} phase(s)
          </div>
          {timeline.length > 0 && (
            <ul style={{ marginTop: 4, marginBottom: 8 }}>
              {timeline.map((item, index) => (
                <li key={`${item.phase}-${index}`}>
                  {item.phase}: {item.startedAt} {"->"} {item.completedAt} ({item.model})
                </li>
              ))}
            </ul>
          )}
          <div>
            <strong>Samples:</strong> {samples.length}
          </div>
          {samples.length > 0 && (
            <div style={{ marginTop: 6, marginBottom: 8, display: "grid", gap: 8 }}>
              {samples.map((sample) => (
                <SampleCard key={`sample-${sample.roundIndex}`} sample={sample} />
              ))}
            </div>
          )}
          <div>
            <strong>Environment:</strong>{" "}
            {environment
              ? `${environment.os} / ${environment.nodeVersion} / ${environment.timezone}`
              : "environment unavailable"}
          </div>
        </div>
      )}
    </section>
  );
}
