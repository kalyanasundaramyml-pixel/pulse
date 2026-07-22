import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { surveysApi } from '../../api/surveys';
import { Survey } from '../../types/api';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';

export function SurveyTemplateListPage({ variant = 'manage' }: { variant?: 'manage' | 'pick' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([surveysApi.list('created'), surveysApi.list('public')])
      .then(([mine, pub]) => {
        setTemplates([...mine.surveys.filter((s) => s.isTemplate), ...pub.surveys]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleStartSurvey(templateId: string) {
    setError(null);
    setStartingId(templateId);
    try {
      const res = await surveysApi.duplicate(templateId, false);
      navigate(`/surveys/${res.survey.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start a survey from this template');
      setStartingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{variant === 'pick' ? 'Use a template' : 'Survey templates'}</h1>
        {variant === 'manage' && (
          <Link to="/surveys/new?type=template" className="button primary">
            + New template
          </Link>
        )}
      </div>
      <p className="muted">
        {variant === 'pick' ? (
          <>
            <Link to="/surveys">Surveys</Link> / Use a template
          </>
        ) : (
          <>
            <Link to="/templates">Templates</Link> / Survey templates
          </>
        )}
      </p>
      <p className="muted">Click a template to start a new survey from it.</p>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : templates.length === 0 ? (
        <p className="empty-state">No templates yet — create one to reuse across surveys.</p>
      ) : (
        <ul className="survey-list">
          {templates.map((t) => {
            const isOwn = t.createdById === user?.id;
            return (
              <li key={t.id}>
                <button type="button" onClick={() => handleStartSurvey(t.id)} disabled={startingId === t.id}>
                  <span className="survey-title">{startingId === t.id ? 'Starting...' : t.title}</span>
                  {t.isPublic && <span className="status-badge public">Public</span>}
                  {!isOwn && t.createdBy && <span className="muted">by {t.createdBy.name}</span>}
                  <span className={`anon-tag ${t.isAnonymous ? 'anonymous' : 'attributed'}`}>
                    {t.isAnonymous ? 'Anonymous' : 'Attributed'}
                  </span>
                </button>
                {variant === 'manage' && isOwn && (
                  <Link to={`/surveys/${t.id}/edit`} className="dashboard-link">
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
