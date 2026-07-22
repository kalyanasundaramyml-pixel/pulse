import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { surveysApi } from '../../api/surveys';
import { Survey } from '../../types/api';
import { useAuth } from '../../hooks/useAuth';

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NewSurveyMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="split-menu" ref={ref}>
      <button type="button" className="button primary" onClick={() => setOpen((o) => !o)}>
        New survey <ChevronDownIcon />
      </button>
      {open && (
        <div className="split-menu-list">
          <Link to="/surveys/new" onClick={() => setOpen(false)}>
            Create fresh
          </Link>
          <Link to="/surveys/templates" onClick={() => setOpen(false)}>
            Use a template
          </Link>
        </div>
      )}
    </div>
  );
}

export function SurveyListPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<'created' | 'targeted'>('targeted');
  const [statusTab, setStatusTab] = useState<'draft' | 'active' | 'closed'>('active');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreate = user?.role === 'LEADER' || user?.role === 'ADMIN';

  useEffect(() => {
    setLoading(true);
    surveysApi
      .list(scope)
      .then((res) => setSurveys(res.surveys))
      .finally(() => setLoading(false));
  }, [scope]);

  function changeScope(next: 'created' | 'targeted') {
    setScope(next);
    // "Drafts" only exists under "Created by me" — reset if it wouldn't apply.
    if (next !== 'created' && statusTab === 'draft') setStatusTab('active');
  }

  const visibleSurveys =
    scope === 'created'
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
        {canCreate && <NewSurveyMenu />}
      </div>
      {canCreate && (
        <div className="tabs">
          <button className={scope === 'targeted' ? 'active' : ''} onClick={() => changeScope('targeted')}>
            Assigned to me
          </button>
          <button className={scope === 'created' ? 'active' : ''} onClick={() => changeScope('created')}>
            Created by me
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
        <p className="empty-state">No {statusTab === 'draft' ? 'draft' : statusTab} surveys here yet.</p>
      ) : (
        <ul className="survey-list">
          {visibleSurveys.map((s) => (
            <li key={s.id}>
              <Link to={scope === 'targeted' ? `/surveys/${s.id}/take` : `/surveys/${s.id}/edit`}>
                <span className="survey-title">{s.title}</span>
                <span className={`status-badge ${s.status.toLowerCase()}`}>{s.status}</span>
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
          ))}
        </ul>
      )}
    </div>
  );
}
