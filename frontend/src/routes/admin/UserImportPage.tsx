import { useRef, useState } from 'react';
import { usersApi } from '../../api/users';
import { ImportResult } from '../../types/api';
import { ApiError } from '../../api/client';

function downloadCsv(result: ImportResult) {
  const header = 'name,email,role,tempPassword\n';
  const rows = result.createdUsers
    .map((u) => `${u.name},${u.email},${u.role},${u.tempPassword}`)
    .join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-${result.batchId}-temp-passwords.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SAMPLE_CSV = 'name,email,role\nJane Smith,jane.smith@example.com,USER\nRaj Patel,raj.patel@example.com,CREATOR\n';

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample-users.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function UserImportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError('Choose a CSV file first');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await usersApi.importCsv(file);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Import users from CSV</h1>
      <div className="import-result">
        <p>CSV format</p>
        <p>
          One header row followed by one row per user: <code>name,email,role</code>. <code>role</code> is optional
          and defaults to <code>USER</code> when omitted; accepted values are <code>ADMIN</code>, <code>CREATOR</code>,
          or <code>USER</code> (case-insensitive).
        </p>
        <p>Example:</p>
        <pre className="temp-password" style={{ display: 'block', whiteSpace: 'pre', padding: '10px 12px' }}>
          {SAMPLE_CSV.trim()}
        </pre>
        <button type="button" onClick={downloadSampleCsv}>
          Download sample CSV
        </button>
      </div>
      <form onSubmit={handleSubmit} className="import-form">
        <input type="file" accept=".csv" ref={fileInput} />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Importing...' : 'Import'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {result && (
        <div className="import-result">
          <p>
            {result.successCount} of {result.totalRows} rows imported successfully. {result.errorCount} errors.
          </p>
          <p>
            There is no email relay configured, so each new user got a random temporary password. Download it now
            and distribute it to the person &mdash; it will not be shown again.
          </p>
          <button onClick={() => downloadCsv(result)}>Download temp passwords CSV</button>
          {result.errors.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Email</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((e, idx) => (
                  <tr key={idx}>
                    <td>{e.row}</td>
                    <td>{e.email}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
