import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { OneOnOneTemplate } from '../../types/api';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';
import { DateSortOption, SortSelect, sortByDate } from '../../components/common/SortSelect';
import { useToast } from '../../components/common/ToastProvider';

export function OneOnOneTemplateListPage({ variant = 'manage' }: { variant?: 'manage' | 'pick' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<OneOnOneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [sort, setSort] = useState<DateSortOption>('createdDesc');

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
      showToast('One-on-one initiated from template');
      navigate(`/one-on-ones/${res.template.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to initiate a one-on-one from this template');
      setStartingId(null);
    }
  }

  return (
    <div className="page">
      {variant === 'manage' && (
        <Link to="/templates" className="back-link">
          ← Back to Templates
        </Link>
      )}
      <div className="page-header">
        <h1>{variant === 'pick' ? 'Use a template' : 'One-on-One templates'}</h1>
        {variant === 'manage' && (
          <Link to="/one-on-ones/new?type=template" className="button primary">
            + New template
          </Link>
        )}
      </div>
      {variant === 'manage' && <p className="muted">Click a template to initiate a new one-on-one from it.</p>}

      {error && <p className="form-error">{error}</p>}

      <div className="list-toolbar">
        <SortSelect value={sort} onChange={setSort} />
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : templates.length === 0 ? (
        <p className="empty-state">No templates yet — create one to start running 1:1s.</p>
      ) : (
        <ul className="survey-list">
          {sortByDate(templates, sort).map((t) => {
            const isOwn = t.createdById === user?.id;
            const canManage = variant === 'manage' && isOwn;
            return (
              <li key={t.id} className={canManage ? 'has-corner-action' : undefined}>
                <button type="button" onClick={() => handleInitiate(t.id)} disabled={startingId === t.id}>
                  <span className="survey-title">{startingId === t.id ? 'Starting...' : t.title}</span>
                  <span className={`status-badge ${t.isPublic ? 'public' : ''}`}>{t.isPublic ? 'Public' : 'Private'}</span>
                  {t.isArchived && <span className="status-badge closed">Archived</span>}
                  {!isOwn && t.createdBy && <span className="muted">by {t.createdBy.name}</span>}
                </button>
                {canManage && (
                  <Link to={`/one-on-ones/${t.id}/edit`} className="corner-link" title="Manage template">
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
