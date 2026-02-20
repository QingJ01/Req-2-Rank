import { listCommunityReports } from "../../report-store.js";

export default async function AdminPage() {
  const reports = listCommunityReports();

  return (
    <section>
      <h1>Admin Dashboard</h1>
      <p className="hub-muted">Community reports and moderation queue.</p>
      <table className="hub-table hub-card">
        <thead>
          <tr>
            <th>ID</th>
            <th>Run</th>
            <th>Reason</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>{report.id}</td>
              <td>{report.runId}</td>
              <td>{report.reason}</td>
              <td>{report.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
