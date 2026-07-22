import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { OneOnOneTemplate } from '../../types/api';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';

export function OneOnOneTemplateListPage({ variant = 'manage' }: { variant?: 'manage' | 'pick' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<OneOnOneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([oneOnOnesApi.list('created'), oneOnOnesApi.list('public')])
      .then(([mine, pub]) => {
        setTemplates([...mine.templates.filter((t) => t.isTemplate), ...pub.templates]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleInitiate(templateId: string) {
    setError(null);
    setStartingId(templateId);
    try {
      const res = await oneOnOnesApi.duplicateTemplate(templateId, false);
      navigate(`/one-on-ones/${res.template.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to initiate a one-on-one from this template');
      setStartingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{variant === 'pick' ? 'Use a template' : 'One-on-One templates'}</h1>
        {variant === 'manage' && (
          <Link to="/one-on-ones/new?type=template" className="button primary">
            + New template
          </Link>
        )}
      </div>
      <p className="muted">
        {variant === 'pick' ? (
          <>
            <Link to="/one-on-ones">One-on-Ones</Link> / Use a template
          </>
        ) : (
          <>
            <Link to="/templates">Templates</Link> / One-on-One templates
          </>
        )}
      </p>
      <p className="muted">Click a template to initiate a new one-on-one from it.</p>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : templates.length === 0 ? (
        <p className="empty-state">No templates yet — create one to start running 1:1s.</p>
      ) : (
        <ul className="survey-list">
          {templates.map((t) => {
            const isOwn = t.createdById === user?.id;
            return (
              <li key={t.id}>
                <button type="button" onClick={() => handleInitiate(t.id)} disabled={startingId === t.id}>
                  <span className="survey-title">{startingId === t.id ? 'Starting...' : t.title}</span>
                  {t.isPublic && <span className="status-badge public">Public</span>}
                  {!isOwn && t.createdBy && <span className="muted">by {t.createdBy.name}</span>}
                </button>
                {variant === 'manage' && isOwn && (
                  <Link to={`/one-on-ones/${t.id}/edit`} className="dashboard-link">
                    Manage template
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
