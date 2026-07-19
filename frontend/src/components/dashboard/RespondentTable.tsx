import { AttributedDashboardDTO } from '../../types/api';

export function RespondentTable({ respondents }: { respondents: AttributedDashboardDTO['respondents'] }) {
  if (respondents.length === 0) {
    return <p className="muted">No responses yet.</p>;
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Submitted</th>
          <th>Last updated</th>
        </tr>
      </thead>
      <tbody>
        {respondents.map((r) => (
          <tr key={r.userId}>
            <td>{r.name}</td>
            <td>{r.email}</td>
            <td>{new Date(r.submittedAt).toLocaleString()}</td>
            <td>{new Date(r.updatedAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
