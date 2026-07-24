import { useEffect, useState } from 'react';
import { membersApi } from '../../api/members';
import { surveysApi } from '../../api/surveys';
import { DirectoryMember } from '../../types/api';
import { ApiError } from '../../api/client';

export function ManageViewers({ surveyId }: { surveyId: string }) {
  const [viewers, setViewers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<DirectoryMember[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await surveysApi.listViewers(surveyId);
      setViewers(res.viewers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load viewers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await membersApi.directory(search);
      if (!cancelled) setResults(res.members);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const viewerIds = new Set(viewers.map((v) => v.id));

  async function handleGrant(memberId: string) {
    setError(null);
    try {
      await surveysApi.grantViewer(surveyId, memberId);
      setSearch('');
      setResults([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to grant viewer access');
    }
  }

  async function handleRevoke(memberId: string) {
    setError(null);
    try {
      await surveysApi.revokeViewer(surveyId, memberId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke viewer access');
    }
  }

  return (
    <section>
      <h2>Manage viewers</h2>
      <p className="muted">
        Grant a specific member or creator access to this survey's dashboard, regardless of their group.
      </p>
      <input
        placeholder="Search people by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="picker-results">
          {results
            .filter((m) => !viewerIds.has(m.id))
            .map((m) => (
              <li key={m.id}>
                <span>
                  {m.name} <span className="muted">{m.email}</span>
                </span>
                <button type="button" onClick={() => handleGrant(m.id)}>
                  Grant viewer
                </button>
              </li>
            ))}
        </ul>
      )}
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading viewers...</p>
      ) : viewers.length === 0 ? (
        <p className="empty-state">No one has been granted viewer access.</p>
      ) : (
        <ul className="picker-selected">
          {viewers.map((v) => (
            <li key={v.id}>
              <span>
                {v.name} <span className="muted">{v.email}</span>
              </span>
              <button type="button" onClick={() => handleRevoke(v.id)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
