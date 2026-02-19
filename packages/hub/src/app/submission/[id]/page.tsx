import { appStore } from "../../state.js";

type SubmissionPageProps = {
  params: {
    id: string;
  };
};

export default async function SubmissionPage({ params }: SubmissionPageProps) {
  const detail = await appStore.getSubmission(params.id);

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
        </div>
      )}
    </section>
  );
}
