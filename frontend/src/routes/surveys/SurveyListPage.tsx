import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { surveysApi } from '../../api/surveys';
import { Survey } from '../../types/api';
import { useAuth } from '../../hooks/useAuth';
import { DateSortOption, SortSelect, sortByDate } from '../../components/common/SortSelect';
import { getSurveyListView, setSurveyListView } from '../../hooks/listView';

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
  const { member } = useAuth();
  const initialView = getSurveyListView();
  const [scope, setScope] = useState<'created' | 'targeted' | 'audit' | 'viewing'>(initialView.scope);
  const [statusTab, setStatusTab] = useState<'draft' | 'active' | 'completed' | 'closed'>(initialView.statusTab);
  const [sort, setSort] = useState<DateSortOption>('createdDesc');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreate = member?.role === 'CREATOR' || member?.role === 'ADMIN';
  const isAuditor = member?.role === 'AUDITOR';

  useEffect(() => {
    setLoading(true);
    surveysApi
      .list(scope)
      .then((res) => setSurveys(res.surveys))
      .finally(() => setLoading(false));
  }, [scope]);

  // Remembered so returning via the top-nav "Surveys" link (rather than a
  // contextual back button) restores whatever tab was last open.
  useEffect(() => {
    setSurveyListView({ scope, statusTab });
  }, [scope, statusTab]);

  useEffect(() => {
    if (scope === 'created' && !canCreate) setScope('targeted');
    if (scope === 'audit' && !isAuditor) setScope('targeted');
  }, [canCreate, isAuditor, scope]);

  function changeScope(next: 'created' | 'targeted' | 'audit' | 'viewing') {
    setScope(next);
    // "Drafts" and "Completed" only exist under one of the two scopes —
    // reset if the current tab wouldn't apply on the other side.
    if (next !== 'created' && statusTab === 'draft') setStatusTab('active');
    if (next === 'created' && statusTab === 'completed') setStatusTab('active');
  }

  const visibleSurveys = sortByDate(
    scope === 'created'
      ? surveys
          .filter((s) => !s.isTemplate)
          .filter((s) => (statusTab === 'draft' ? 'DRAFT' : statusTab === 'closed' ? 'CLOSED' : 'PUBLISHED') === s.status)
      : scope === 'audit' || scope === 'viewing'
        ? // Read-only oversight views — every status, no sub-filtering.
          surveys
        : // Assigned to me: a recipient never sees a still-draft (unpublished) survey.
          // Pending/Completed split by the survey's own status vs whether this
          // member has already responded — Closed always wins regardless of that.
          surveys
            .filter((s) => s.status !== 'DRAFT')
            .filter((s) => {
              if (statusTab === 'closed') return s.status === 'CLOSED';
              if (statusTab === 'completed') return s.status !== 'CLOSED' && !!s.hasResponded;
              return s.status !== 'CLOSED' && !s.hasResponded;
            }),
    sort,
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Surveys</h1>
        {canCreate && <NewSurveyMenu />}
      </div>
      <div className="tabs">
        <button className={scope === 'targeted' ? 'active' : ''} onClick={() => changeScope('targeted')}>
          Assigned to me
        </button>
        {canCreate && (
          <button className={scope === 'created' ? 'active' : ''} onClick={() => changeScope('created')}>
            Created by me
          </button>
        )}
        {isAuditor && (
          <button className={scope === 'audit' ? 'active' : ''} onClick={() => changeScope('audit')}>
            Audit
          </button>
        )}
        <button className={scope === 'viewing' ? 'active' : ''} onClick={() => changeScope('viewing')}>
          Viewing
        </button>
      </div>
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
          <SortSelect value={sort} onChange={setSort} />
        </div>
      )}
      {scope === 'targeted' && (
        <div className="subtabs">
          <button className={statusTab === 'active' ? 'active' : ''} onClick={() => setStatusTab('active')}>
            Pending
          </button>
          <button className={statusTab === 'completed' ? 'active' : ''} onClick={() => setStatusTab('completed')}>
            Completed
          </button>
          <button className={statusTab === 'closed' ? 'active' : ''} onClick={() => setStatusTab('closed')}>
            Closed
          </button>
          <SortSelect value={sort} onChange={setSort} />
        </div>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : visibleSurveys.length === 0 ? (
        <p className="empty-state">
          No {scope === 'audit' || scope === 'viewing' ? '' : scope === 'targeted' && statusTab === 'active' ? 'pending ' : `${statusTab} `}
          surveys here yet.
        </p>
      ) : (
        <ul className="survey-list">
          {visibleSurveys.map((s) => {
            const completed = s.isAnonymous ? s._count?.responseAccess : s._count?.attributedResponses;
            const linkTarget =
              scope === 'targeted'
                ? `/surveys/${s.id}/take`
                : scope === 'audit' || scope === 'viewing'
                  ? `/surveys/${s.id}/dashboard`
                  : `/surveys/${s.id}/edit`;
            return (
              <li key={s.id} className={scope === 'created' ? 'has-corner-action' : undefined}>
                <Link to={linkTarget} className="has-meta">
                  <div className="survey-row">
                    <span className="survey-title">{s.title}</span>
                    <span className={`status-badge ${s.status.toLowerCase()}`}>{s.status}</span>
                    <span className={`anon-tag ${s.isAnonymous ? 'anonymous' : 'attributed'}`}>
                      {s.isAnonymous ? 'Anonymous' : 'Attributed'}
                    </span>
                  </div>
                  <div className="survey-meta">
                    <span>Created {new Date(s.createdAt).toLocaleDateString()}</span>
                    {scope === 'created' ? (
                      <>
                        <span>Questions {s._count?.questions ?? 0}</span>
                        <span>
                          Participants {completed ?? 0}/{s._count?.recipients ?? 0}
                        </span>
                      </>
                    ) : scope === 'audit' || scope === 'viewing' ? (
                      <>
                        {s.createdBy && <span>By {s.createdBy.name}</span>}
                        <span>Questions {s._count?.questions ?? 0}</span>
                      </>
                    ) : (
                      <>
                        <span>Due date {s.endDate ? new Date(s.endDate).toLocaleDateString() : 'N/A'}</span>
                        <span>Questions {s._count?.questions ?? 0}</span>
                      </>
                    )}
                  </div>
                </Link>
                {scope === 'created' && (
                  <Link to={`/surveys/${s.id}/dashboard`} className="corner-link" title="View dashboard">
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
