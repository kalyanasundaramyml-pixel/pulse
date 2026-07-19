import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { OneOnOneRun, OneOnOneTemplate } from '../../types/api';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';

export function OneOnOneListPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'assigned' | 'templates'>('assigned');
  const [runs, setRuns] = useState<OneOnOneRun[]>([]);
  const [templates, setTemplates] = useState<OneOnOneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'LEADER' || user?.role === 'ADMIN';

  useEffect(() => {
    setLoading(true);
    if (tab === 'assigned') {
      oneOnOnesApi
        .myRuns()
        .then((res) => setRuns(res.runs))
        .finally(() => setLoading(false));
    } else {
      Promise.all([oneOnOnesApi.list('created'), oneOnOnesApi.list('public')])
        .then(([mine, pub]) => setTemplates([...mine.templates, ...pub.templates]))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  async function handleCopyToMyTemplates(templateId: string) {
    setError(null);
    try {
      await oneOnOnesApi.duplicateTemplate(templateId);
      setTab('templates');
      const [mine, pub] = await Promise.all([oneOnOnesApi.list('created'), oneOnOnesApi.list('public')]);
      setTemplates([...mine.templates, ...pub.templates]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to copy this template');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>One-on-Ones</h1>
        {canManage && tab === 'templates' && (
          <Link to="/one-on-ones/new" className="button">
            New template
          </Link>
        )}
      </div>
      {canManage && (
        <div className="tabs">
          <button className={tab === 'assigned' ? 'active' : ''} onClick={() => setTab('assigned')}>
            Assigned to me
          </button>
          <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
            My templates
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : tab === 'assigned' ? (
        runs.length === 0 ? (
          <p className="empty-state">No one-on-ones assigned to you yet.</p>
        ) : (
          <ul className="survey-list">
            {runs.map((r) => (
              <li key={r.id}>
                <Link to={`/one-on-ones/runs/${r.id}/take`}>
                  <span className="survey-title">{r.template?.title}</span>
                  <span className={`status-badge ${r.status === 'PENDING' ? 'draft' : 'published'}`}>
                    {r.status === 'PENDING' ? 'To do' : 'Completed'}
                  </span>
                  <span className="muted">{new Date(r.createdAt).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : templates.length === 0 ? (
        <p className="empty-state">No templates yet — create one to start running 1:1s.</p>
      ) : (
        <ul className="survey-list">
          {templates.map((t) => {
            const isOwn = t.createdById === user?.id;
            return (
              <li key={t.id}>
                <Link to={`/one-on-ones/${t.id}/edit`}>
                  <span className="survey-title">{t.title}</span>
                  {t.isArchived && <span className="status-badge closed">ARCHIVED</span>}
                  {t.isPublic && <span className="status-badge public">Public</span>}
                  {!isOwn && t.createdBy && <span className="muted">by {t.createdBy.name}</span>}
                </Link>
                {!isOwn && (
                  <button onClick={() => handleCopyToMyTemplates(t.id)} className="dashboard-link">
                    Copy to my templates
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
