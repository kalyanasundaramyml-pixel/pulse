import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { surveysApi } from '../../api/surveys';
import { SurveyDetail } from '../../types/api';
import { ApiError } from '../../api/client';
import { BlockApi, BlockList } from '../../components/surveys/BlockList';
import { BuilderPreviewPanel } from '../../components/surveys/BuilderPreviewPanel';
import { AnonymityBadge } from '../../components/surveys/AnonymityBadge';
import { useAuth } from '../../hooks/useAuth';

export function SurveyBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id;

  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reopenDate, setReopenDate] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);

  const blockApi: BlockApi = {
    addBlock: (name) => surveysApi.addBlock(id!, name),
    updateBlock: (blockId, input) => surveysApi.updateBlock(id!, blockId, input),
    deleteBlock: (blockId) => surveysApi.deleteBlock(id!, blockId),
    reorderBlocks: (blockIds) => surveysApi.reorderBlocks(id!, blockIds),
    addQuestion: (blockId, input) => surveysApi.addQuestion(id!, blockId, input),
    updateQuestion: (blockId, questionId, input) => surveysApi.updateQuestion(id!, blockId, questionId, input),
    deleteQuestion: (blockId, questionId) => surveysApi.deleteQuestion(id!, blockId, questionId),
    reorderQuestions: (blockId, questionIds) => surveysApi.reorderQuestions(id!, blockId, questionIds),
  };

  async function loadSurvey(surveyId: string) {
    setLoading(true);
    try {
      const res = await surveysApi.get(surveyId);
      setSurvey(res.survey);
      setTitle(res.survey.title);
      setDescription(res.survey.description ?? '');
      setIsAnonymous(res.survey.isAnonymous);
      setEndDate(res.survey.endDate ? res.survey.endDate.slice(0, 10) : '');
      setShowReopenForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadSurvey(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await surveysApi.create({
        title,
        description: description || undefined,
        isAnonymous,
        endDate: isTemplate ? null : endDate || null,
        isTemplate,
      });
      navigate(`/surveys/${res.survey.id}/edit`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create survey');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDetails(e?: FormEvent) {
    e?.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await surveysApi.update(id, { title, description: description || undefined, isAnonymous, endDate: endDate || null });
      await loadSurvey(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save survey');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish() {
    if (!id) return;
    setError(null);
    try {
      await surveysApi.publish(id);
      await loadSurvey(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish survey');
    }
  }

  async function handleClose() {
    if (!id) return;
    await surveysApi.close(id);
    await loadSurvey(id);
  }

  async function handleUnpublish() {
    if (!id) return;
    setError(null);
    try {
      await surveysApi.unpublish(id);
      await loadSurvey(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unpublish survey');
    }
  }

  async function handleReopen() {
    if (!id) return;
    setError(null);
    try {
      await surveysApi.reopen(id, reopenDate || null);
      await loadSurvey(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reopen survey');
    }
  }

  async function handleDuplicate() {
    if (!id) return;
    setError(null);
    try {
      const res = await surveysApi.duplicate(id);
      navigate(`/surveys/${res.survey.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to duplicate survey');
    }
  }

  async function handleStartSurvey() {
    if (!id) return;
    setError(null);
    try {
      const res = await surveysApi.duplicate(id, false);
      navigate(`/surveys/${res.survey.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start a survey from this template');
    }
  }

  async function handleCopyToMyTemplates() {
    if (!id) return;
    setError(null);
    try {
      const res = await surveysApi.duplicate(id, true);
      navigate(`/surveys/${res.survey.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to copy this template');
    }
  }

  async function handleTogglePublic() {
    if (!id || !survey) return;
    setError(null);
    try {
      await surveysApi.update(id, { isPublic: !survey.isPublic });
      await loadSurvey(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update sharing setting');
    }
  }

  async function handleDelete() {
    if (!id || !survey) return;
    const warning = isDraft
      ? `Delete this draft ${survey.isTemplate ? 'template' : 'survey'}? This cannot be undone.`
      : `Delete this ${survey.status.toLowerCase()} survey and all of its responses? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setError(null);
    try {
      await surveysApi.remove(id);
      navigate('/surveys');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete survey');
    }
  }

  if (isNew) {
    return (
      <div className="page">
        <h1>New survey</h1>
        <form className="survey-form" onSubmit={handleCreate}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
            Anonymous survey (respondent identity will not be linked to answers)
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
            Save as a reusable template instead of a live survey
          </label>
          {!isTemplate && (
            <label>
              End date (optional)
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : isTemplate ? 'Create template' : 'Create draft'}
          </button>
        </form>
      </div>
    );
  }

  if (loading) return <p>Loading...</p>;
  if (!survey) return <p className="form-error">{error ?? 'Survey not found'}</p>;

  const isDraft = survey.status === 'DRAFT';
  const isAnonymityLocked = survey.publishedAt != null;
  const isOwner = user?.role === 'ADMIN' || survey.createdById === user?.id;

  if (survey.isTemplate && !isOwner) {
    return (
      <div className="page builder-layout">
        <div className="builder-main">
          <div className="page-header">
            <h1>{survey.title}</h1>
            <span className="status-badge template">Template</span>
          </div>
          <p className="muted">
            Public template{survey.createdBy ? ` by ${survey.createdBy.name}` : ''} —{' '}
            {survey.isAnonymous ? 'anonymous' : 'attributed'} questions, read-only.
          </p>
          {survey.description && <p>{survey.description}</p>}

          {error && <p className="form-error">{error}</p>}

          <BlockList blocks={survey.blocks} api={blockApi} editable={false} onChanged={() => {}} />

          <section className="survey-actions">
            <button onClick={handleStartSurvey} className="primary">
              Start a survey
            </button>
            <button onClick={handleCopyToMyTemplates}>Copy to my templates</button>
          </section>
        </div>
        <BuilderPreviewPanel
          title={survey.title}
          description={survey.description}
          blocks={survey.blocks}
          topNote={<AnonymityBadge isAnonymous={survey.isAnonymous} />}
        />
      </div>
    );
  }

  return (
    <div className="page builder-layout">
    <div className="builder-main">
      <div className="page-header">
        <h1>{survey.title}</h1>
        {survey.isTemplate ? (
          <>
            <span className="status-badge template">Template</span>
            {survey.isPublic && <span className="status-badge public">Public</span>}
          </>
        ) : (
          <span className={`status-badge ${survey.status.toLowerCase()}`}>{survey.status}</span>
        )}
      </div>

      {isDraft ? (
        <div className="survey-form">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isAnonymous}
              disabled={isAnonymityLocked}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            Anonymous survey
          </label>
          {isAnonymityLocked && (
            <p className="muted">
              This survey has already been published once, so its anonymous/attributed setting is locked —
              respondents relied on that promise.
            </p>
          )}
          {!survey.isTemplate && (
            <label>
              End date (optional)
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          )}
        </div>
      ) : (
        <p className="muted">
          {survey.isAnonymous ? 'Anonymous' : 'Attributed'} survey — locked while {survey.status.toLowerCase()}.
          {survey.endDate && ` Ends ${new Date(survey.endDate).toLocaleDateString()}.`}
        </p>
      )}

      {error && <p className="form-error">{error}</p>}

      <BlockList blocks={survey.blocks} api={blockApi} editable={isDraft} onChanged={() => loadSurvey(id!)} />

      <section>
        <h2>Recipients ({survey.recipients.length})</h2>
      </section>

      <section className="survey-actions">
        <Link to={`/surveys/${id}/recipients`} className="button">
          Manage recipients
        </Link>
        {isDraft && (
          <button onClick={() => handleSaveDetails()} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save details'}
          </button>
        )}
        {survey.isTemplate ? (
          <>
            <button onClick={handleStartSurvey} className="primary">
              Start a survey
            </button>
            <button onClick={handleTogglePublic}>{survey.isPublic ? 'Make private' : 'Make public'}</button>
          </>
        ) : (
          <>
            {isDraft && (
              <button onClick={handlePublish} className="primary">
                Publish
              </button>
            )}
            {(survey.status === 'PUBLISHED' || survey.status === 'CLOSED') && (
              <button onClick={handleUnpublish}>Unpublish to edit</button>
            )}
            {survey.status === 'PUBLISHED' && <button onClick={handleClose}>Close survey</button>}
            {survey.status === 'CLOSED' && !showReopenForm && (
              <button onClick={() => setShowReopenForm(true)}>Reopen</button>
            )}
            <button onClick={handleDuplicate}>Duplicate</button>
            <Link to={`/surveys/${id}/dashboard`} className="button">
              View dashboard
            </Link>
          </>
        )}
        {(isDraft || user?.role === 'ADMIN') && (
          <button onClick={handleDelete} className="danger">
            Delete {survey.isTemplate ? 'template' : 'survey'}
          </button>
        )}
      </section>

      {showReopenForm && (
        <section className="survey-form">
          <label>
            New end date (optional — leave blank for no end date)
            <input type="date" value={reopenDate} onChange={(e) => setReopenDate(e.target.value)} />
          </label>
          <div className="survey-actions">
            <button onClick={handleReopen} className="primary">
              Confirm reopen
            </button>
            <button onClick={() => setShowReopenForm(false)}>Cancel</button>
          </div>
        </section>
      )}
    </div>
    <BuilderPreviewPanel
      title={survey.title}
      description={survey.description}
      blocks={survey.blocks}
      topNote={<AnonymityBadge isAnonymous={survey.isAnonymous} />}
    />
    </div>
  );
}
