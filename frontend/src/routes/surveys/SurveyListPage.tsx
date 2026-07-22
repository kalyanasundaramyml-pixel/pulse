import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { surveysApi } from '../../api/surveys';
import { Survey } from '../../types/api';
import { useAuth } from '../../hooks/useAuth';

export function SurveyListPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<'created' | 'targeted' | 'templates'>('targeted');
  const [statusTab, setStatusTab] = useState<'draft' | 'active' | 'closed'>('active');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreate = user?.role === 'LEADER' || user?.role === 'ADMIN';

  useEffect(() => {
    setLoading(true);
    if (scope === 'templates') {
      Promise.all([surveysApi.list('created'), surveysApi.list('public')])
        .then(([mine, pub]) => {
          setSurveys([...mine.surveys.filter((s) => s.isTemplate), ...pub.surveys]);
        })
        .finally(() => setLoading(false));
    } else {
      surveysApi
        .list(scope)
        .then((res) => setSurveys(res.surveys))
        .finally(() => setLoading(false));
    }
  }, [scope]);

  function changeScope(next: 'created' | 'targeted' | 'templates') {
    setScope(next);
    // "Drafts" only exists under "Created by me" — reset if it wouldn't apply.
    if (next !== 'created' && statusTab === 'draft') setStatusTab('active');
  }

  const visibleSurveys =
    scope === 'templates'
      ? surveys
      : scope === 'created'
        ? surveys
            .filter((s) => !s.isTemplate)
            .filter((s) => (statusTab === 'draft' ? 'DRAFT' : statusTab === 'closed' ? 'CLOSED' : 'PUBLISHED') === s.status)
        : // Assigned to me: a recipient never sees a still-draft (unpublished) survey.
          surveys
            .filter((s) => s.status !== 'DRAFT')
            .filter((s) => (statusTab === 'closed' ? s.status === 'CLOSED' : s.status !== 'CLOSED'));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Surveys</h1>
        {canCreate && (
          <Link to="/surveys/new" className="button">
            New survey
          </Link>
        )}
      </div>
      {canCreate && (
        <div className="tabs">
          <button className={scope === 'targeted' ? 'active' : ''} onClick={() => changeScope('targeted')}>
            Assigned to me
          </button>
          <button className={scope === 'created' ? 'active' : ''} onClick={() => changeScope('created')}>
            Created by me
          </button>
          <button className={scope === 'templates' ? 'active' : ''} onClick={() => changeScope('templates')}>
            Templates
          </button>
        </div>
      )}
      {scope === 'created' && (
        <div className="subtabs">
          <button className={statusTab === 'draft' ? 'active' : ''} onClick={() => setStatusTab('draft')}>
            Drafts
          </button>
          <button className={statusTab === 'active' ? 'active' : ''} onClick={() => setStatusTab('active')}>
            Active
          </button>
          <button className={statusTab === 'closed' ? 'active' : ''} onClick={() => setStatusTab('closed')}>
            Closed
          </button>
        </div>
      )}
      {scope === 'targeted' && (
        <div className="subtabs">
          <button className={statusTab === 'active' ? 'active' : ''} onClick={() => setStatusTab('active')}>
            In progress
          </button>
          <button className={statusTab === 'closed' ? 'active' : ''} onClick={() => setStatusTab('closed')}>
            Closed
          </button>
        </div>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : visibleSurveys.length === 0 ? (
        <p className="empty-state">
          {scope === 'templates' ? 'No templates here yet.' : `No ${statusTab === 'draft' ? 'draft' : statusTab} surveys here yet.`}
        </p>
      ) : (
        <ul className="survey-list">
          {visibleSurveys.map((s) => {
            const isOwn = s.createdById === user?.id;
            return (
              <li key={s.id}>
                <Link to={scope === 'targeted' ? `/surveys/${s.id}/take` : `/surveys/${s.id}/edit`}>
                  <span className="survey-title">{s.title}</span>
                  {scope === 'templates' ? (
                    <>
                      {s.isPublic && <span className="status-badge public">Public</span>}
                      {!isOwn && s.createdBy && <span className="muted">by {s.createdBy.name}</span>}
                    </>
                  ) : (
                    <span className={`status-badge ${s.status.toLowerCase()}`}>{s.status}</span>
                  )}
                  <span className={`anon-tag ${s.isAnonymous ? 'anonymous' : 'attributed'}`}>
                    {s.isAnonymous ? 'Anonymous' : 'Attributed'}
                  </span>
                </Link>
                {scope === 'created' && (
                  <Link to={`/surveys/${s.id}/dashboard`} className="dashboard-link">
                    Dashboard
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
