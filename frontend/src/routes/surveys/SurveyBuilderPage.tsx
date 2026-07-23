import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { surveysApi } from '../../api/surveys';
import { SurveyDetail } from '../../types/api';
import { ApiError } from '../../api/client';
import { BlockApi, BlockList, BlockListHandle } from '../../components/surveys/BlockList';
import { BuilderPreviewPanel } from '../../components/surveys/BuilderPreviewPanel';
import { AnonymityBadge } from '../../components/surveys/AnonymityBadge';
import { useAuth } from '../../hooks/useAuth';
import { useTemplateNav } from '../../hooks/useTemplateNav';
import { getSurveyListView, surveyListViewLabel } from '../../hooks/listView';
import { useToast } from '../../components/common/ToastProvider';

export function SurveyBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { setIsTemplateActive } = useTemplateNav();
  const [searchParams] = useSearchParams();
  const isNew = !id;

  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [isTemplate] = useState(searchParams.get('type') === 'template');
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reopenDate, setReopenDate] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopeningUserId, setReopeningUserId] = useState<string | null>(null);
  const [blocksDirty, setBlocksDirty] = useState(false);
  const createdRef = useRef(false);
  const blockListRef = useRef<BlockListHandle>(null);

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
      // Adding a question/block reloads the survey to pick up the change, but
      // that reload must never clobber a title/description/anonymity/end-date
      // edit that's still sitting in the 800ms autosave debounce window — so
      // each field only adopts the server value if it wasn't locally edited
      // since the last load (compared against the *previous* `survey`, still
      // in scope here). A genuinely unsaved edit is left alone; the pending
      // autosave will land it moments later.
      const prevSurvey = survey;
      setSurvey(res.survey);
      setTitle((prevTitle) => (prevSurvey && prevTitle !== prevSurvey.title ? prevTitle : res.survey.title));
      setDescription((prevDescription) =>
        prevSurvey && prevDescription !== (prevSurvey.description ?? '') ? prevDescription : (res.survey.description ?? ''),
      );
      setIsAnonymous((prevIsAnonymous) =>
        prevSurvey && prevIsAnonymous !== prevSurvey.isAnonymous ? prevIsAnonymous : res.survey.isAnonymous,
      );
      setEndDate((prevEndDate) => {
        const prevServerEndDate = prevSurvey?.endDate ? prevSurvey.endDate.slice(0, 10) : '';
        return prevSurvey && prevEndDate !== prevServerEndDate
          ? prevEndDate
          : res.survey.endDate
            ? res.survey.endDate.slice(0, 10)
            : '';
      });
      setShowReopenForm(false);
      setBlocksDirty(false);
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

  useEffect(() => {
    if (!isNew || createdRef.current) return;
    createdRef.current = true;
    setError(null);
    surveysApi
      .create({
        title: isTemplate ? 'Untitled template' : 'Untitled survey',
        isAnonymous: true,
        isTemplate,
      })
      .then((res) => {
        navigate(`/surveys/${res.survey.id}/edit`, { replace: true });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to create survey');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  useEffect(() => {
    setIsTemplateActive(isTemplate || !!survey?.isTemplate);
    return () => setIsTemplateActive(false);
  }, [isTemplate, survey?.isTemplate, setIsTemplateActive]);

  // Live (non-template) drafts autosave as you type — no manual "Save details" step.
  // Templates keep an explicit Save/Discard so a deliberate edit to a reusable asset
  // isn't silently persisted.
  useEffect(() => {
    if (!survey || survey.isTemplate || survey.status !== 'DRAFT') return;
    const changed =
      title !== survey.title ||
      description !== (survey.description ?? '') ||
      isAnonymous !== survey.isAnonymous ||
      endDate !== (survey.endDate ? survey.endDate.slice(0, 10) : '');
    if (!changed) return;
    const timer = setTimeout(() => {
      handleSaveDetails();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, isAnonymous, endDate, survey]);

  async function handleSaveDetails(e?: FormEvent): Promise<boolean> {
    e?.preventDefault();
    if (!id) return false;
    setError(null);
    setSubmitting(true);
    try {
      await surveysApi.update(id, { title, description: description || undefined, isAnonymous, endDate: endDate || null });
      if (blockListRef.current) {
        await blockListRef.current.flush();
      } else {
        await loadSurvey(id);
      }
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save survey');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish() {
    if (!id) return;
    setError(null);
    try {
      // Flush any edit still sitting in the debounce window first — publishing
      // locks the anonymous/attributed choice in permanently, so it must never
      // fire against a stale value.
      await handleSaveDetails();
      await surveysApi.publish(id);
      await loadSurvey(id);
      showToast('Survey published');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish survey');
    }
  }

  async function handleClose() {
    if (!id) return;
    setError(null);
    try {
      await surveysApi.close(id);
      await loadSurvey(id);
      showToast('Survey closed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to close survey');
    }
  }

  async function handleUnpublish() {
    if (!id) return;
    setError(null);
    try {
      await surveysApi.unpublish(id);
      await loadSurvey(id);
      showToast('Unpublished — you can edit it again');
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
      showToast('Survey reopened');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reopen survey');
    }
  }

  async function handleReopenForRecipient(userId: string) {
    if (!id) return;
    setError(null);
    setReopeningUserId(userId);
    try {
      await surveysApi.reopenForRecipient(id, userId);
      await loadSurvey(id);
      showToast('Reopened for this recipient');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reopen for this recipient');
    } finally {
      setReopeningUserId(null);
    }
  }

  async function handleDuplicate() {
    if (!id) return;
    setError(null);
    try {
      await handleSaveDetails();
      const res = await surveysApi.duplicate(id);
      showToast('Survey duplicated');
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
      showToast('Survey created from template');
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
      showToast('Template copied to your templates');
      navigate(`/surveys/${res.survey.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to copy this template');
    }
  }

  async function handleTogglePublic() {
    if (!id || !survey) return;
    setError(null);
    try {
      // Flush any edit still sitting in the debounce window first — otherwise
      // the reload below can overwrite it with the stale value still in the DB.
      await handleSaveDetails();
      const nextIsPublic = !survey.isPublic;
      await surveysApi.update(id, { isPublic: nextIsPublic });
      await loadSurvey(id);
      showToast(nextIsPublic ? 'Made public' : 'Made private');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update sharing setting');
    }
  }

  function handleDiscardChanges() {
    if (!survey) return;
    setTitle(survey.title);
    setDescription(survey.description ?? '');
    setIsAnonymous(survey.isAnonymous);
    setEndDate(survey.endDate ? survey.endDate.slice(0, 10) : '');
    blockListRef.current?.discard();
    showToast('Changes discarded');
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
      showToast(`${survey.isTemplate ? 'Template' : 'Survey'} deleted`);
      navigate(survey.isTemplate ? '/templates/surveys' : '/surveys');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete survey');
    }
  }

  if (isNew) {
    return (
      <div className="page">
        {error ? <p className="form-error">{error}</p> : <p>Creating...</p>}
      </div>
    );
  }

  if (loading) return <p>Loading...</p>;
  if (!survey) return <p className="form-error">{error ?? 'Survey not found'}</p>;

  const isDraft = survey.status === 'DRAFT';
  const isAnonymityLocked = survey.publishedAt != null;
  const isOwner = user?.role === 'ADMIN' || survey.createdById === user?.id;
  const hasUnsavedChanges =
    title !== survey.title ||
    description !== (survey.description ?? '') ||
    isAnonymous !== survey.isAnonymous ||
    endDate !== (survey.endDate ? survey.endDate.slice(0, 10) : '') ||
    blocksDirty;

  const backLink = survey.isTemplate ? (
    <Link to="/templates/surveys" className="back-link">
      ← Back to Survey templates
    </Link>
  ) : (
    <Link to="/surveys" className="back-link">
      ← Back to {surveyListViewLabel(getSurveyListView())}
    </Link>
  );

  if (survey.isTemplate && !isOwner) {
    return (
      <div className="page builder-layout">
        <div className="builder-main">
          {backLink}
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
      {backLink}
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
          {!survey.isTemplate && submitting && <p className="muted">Saving...</p>}
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

      <BlockList
        ref={blockListRef}
        blocks={survey.blocks}
        api={blockApi}
        editable={isDraft}
        deferSave={survey.isTemplate}
        onDirtyChange={setBlocksDirty}
        onChanged={() => loadSurvey(id!)}
      />

      <section>
        <h2>Recipients ({survey.recipients.length})</h2>
        {!survey.isTemplate && survey.recipients.length > 0 && (
          <ul className="recipient-status-list">
            {survey.recipients.map((r) => (
              <li key={r.user.id}>
                <span>
                  {r.user.name} <span className="muted">{r.user.email}</span>
                </span>
                {/* Anonymous surveys can never single out one respondent — that
                    would undercut the anonymity guarantee — so no reopen option here. */}
                {survey.isAnonymous ? null : r.resubmitAllowed ? (
                  <span className="status-badge public">Reopened</span>
                ) : (
                  !isDraft && (
                    <button
                      type="button"
                      disabled={reopeningUserId === r.user.id}
                      onClick={() => handleReopenForRecipient(r.user.id)}
                    >
                      {reopeningUserId === r.user.id ? 'Reopening...' : 'Reopen'}
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="survey-actions">
        <Link to={`/surveys/${id}/recipients`} className="button">
          Manage recipients
        </Link>
        {survey.isTemplate ? (
          <>
            <button
              onClick={async () => {
                if (await handleSaveDetails()) showToast('Changes saved');
              }}
              disabled={submitting || !hasUnsavedChanges}
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleDiscardChanges} disabled={!hasUnsavedChanges}>
              Discard changes
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
