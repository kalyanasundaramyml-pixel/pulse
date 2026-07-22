import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { OneOnOneRun, OneOnOneTemplate } from '../../types/api';
import { useAuth } from '../../hooks/useAuth';

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NewOneOnOneMenu() {
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
        New One-on-One <ChevronDownIcon />
      </button>
      {open && (
        <div className="split-menu-list">
          <Link to="/one-on-ones/new" onClick={() => setOpen(false)}>
            Create fresh
          </Link>
          <Link to="/one-on-ones/templates" onClick={() => setOpen(false)}>
            Use a template
          </Link>
        </div>
      )}
    </div>
  );
}

export function OneOnOneListPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<'assigned' | 'initiated'>(initialTab === 'initiated' ? 'initiated' : 'assigned');
  const [assignedFilter, setAssignedFilter] = useState<'todo' | 'completed'>('todo');
  const [initiatedFilter, setInitiatedFilter] = useState<'draft' | 'published'>('draft');
  const [runs, setRuns] = useState<OneOnOneRun[]>([]);
  const [mine, setMine] = useState<OneOnOneTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = user?.role === 'LEADER' || user?.role === 'ADMIN';

  useEffect(() => {
    setLoading(true);
    if (tab === 'assigned') {
      oneOnOnesApi
        .myRuns()
        .then((res) => setRuns(res.runs))
        .finally(() => setLoading(false));
    } else {
      oneOnOnesApi
        .list('created')
        .then((res) => setMine(res.templates))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const initiated = mine
    .filter((t) => !t.isTemplate)
    .filter((t) => (initiatedFilter === 'published' ? t.status === 'PUBLISHED' : t.status === 'DRAFT'));
  const visibleRuns = runs.filter((r) => (assignedFilter === 'completed' ? r.status === 'COMPLETED' : r.status === 'PENDING'));

  return (
    <div className="page">
      <div className="page-header">
        <h1>One-on-Ones</h1>
        {canManage && <NewOneOnOneMenu />}
      </div>
      {canManage && (
        <div className="tabs">
          <button className={tab === 'assigned' ? 'active' : ''} onClick={() => setTab('assigned')}>
            Assigned to me
          </button>
          <button className={tab === 'initiated' ? 'active' : ''} onClick={() => setTab('initiated')}>
            Initiated by me
          </button>
        </div>
      )}
      {tab === 'assigned' && (
        <div className="subtabs">
          <button className={assignedFilter === 'todo' ? 'active' : ''} onClick={() => setAssignedFilter('todo')}>
            To do
          </button>
          <button
            className={assignedFilter === 'completed' ? 'active' : ''}
            onClick={() => setAssignedFilter('completed')}
          >
            Completed
          </button>
        </div>
      )}
      {tab === 'initiated' && (
        <div className="subtabs">
          <button className={initiatedFilter === 'draft' ? 'active' : ''} onClick={() => setInitiatedFilter('draft')}>
            Drafts
          </button>
          <button
            className={initiatedFilter === 'published' ? 'active' : ''}
            onClick={() => setInitiatedFilter('published')}
          >
            Published
          </button>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : tab === 'assigned' ? (
        visibleRuns.length === 0 ? (
          <p className="empty-state">No {assignedFilter === 'completed' ? 'completed' : 'to-do'} one-on-ones here yet.</p>
        ) : (
          <ul className="survey-list">
            {visibleRuns.map((r) => (
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
      ) : initiated.length === 0 ? (
        <p className="empty-state">
          No {initiatedFilter} one-on-ones yet — start one from a template under Templates or create a fresh one.
        </p>
      ) : (
        <ul className="survey-list">
          {initiated.map((t) => (
            <li key={t.id}>
              <Link to={`/one-on-ones/${t.id}/edit`}>
                <span className="survey-title">{t.title}</span>
                <span className={`status-badge ${t.status.toLowerCase()}`}>{t.status}</span>
                {t.isArchived && <span className="status-badge closed">ARCHIVED</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
