import { listCommunityReports } from "../../report-store.js";

export default async function AdminPage() {
  const reports = listCommunityReports();

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>
      <p style={{ color: "#4e5566" }}>Community reports and moderation queue.</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>ID</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Run</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Reason</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td style={{ padding: 8 }}>{report.id}</td>
              <td style={{ padding: 8 }}>{report.runId}</td>
              <td style={{ padding: 8 }}>{report.reason}</td>
              <td style={{ padding: 8 }}>{report.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
