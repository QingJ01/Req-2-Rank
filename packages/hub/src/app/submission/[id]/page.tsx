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
      <h1>Submission Detail</h1>
      {!detail ? (
        <p className="hub-muted">Submission not found.</p>
      ) : (
        <div className="hub-card" style={{ padding: 16, lineHeight: 1.7 }}>
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

          <h2>Dimension Scores</h2>
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

          <h2>Evidence Chain</h2>
          <div>
            <strong>Timeline:</strong> {timeline.length} phase(s)
          </div>
          {timeline.length > 0 && (
            <ul>
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
            <div className="hub-grid" style={{ marginTop: 6, marginBottom: 8 }}>
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
