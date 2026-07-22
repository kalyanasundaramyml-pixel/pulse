import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { OneOnOneTemplateDetail } from '../../types/api';
import { ApiError } from '../../api/client';
import { BlockApi, BlockList, BlockListHandle } from '../../components/surveys/BlockList';
import { BuilderPreviewPanel } from '../../components/surveys/BuilderPreviewPanel';
import { useAuth } from '../../hooks/useAuth';
import { useTemplateNav } from '../../hooks/useTemplateNav';

export function OneOnOneBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setIsTemplateActive } = useTemplateNav();
  const [searchParams] = useSearchParams();
  const isNew = !id;
  const [isTemplate] = useState(searchParams.get('type') === 'template');

  const [template, setTemplate] = useState<OneOnOneTemplateDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startingRunFor, setStartingRunFor] = useState<string | null>(null);
  const [runStartedFor, setRunStartedFor] = useState<string | null>(null);
  const [blocksDirty, setBlocksDirty] = useState(false);
  const createdRef = useRef(false);
  const blockListRef = useRef<BlockListHandle>(null);

  const blockApi: BlockApi = {
    addBlock: (name) => oneOnOnesApi.addBlock(id!, name),
    updateBlock: (blockId, input) => oneOnOnesApi.updateBlock(id!, blockId, input),
    deleteBlock: (blockId) => oneOnOnesApi.deleteBlock(id!, blockId),
    reorderBlocks: (blockIds) => oneOnOnesApi.reorderBlocks(id!, blockIds),
    addQuestion: (blockId, input) => oneOnOnesApi.addQuestion(id!, blockId, input),
    updateQuestion: (blockId, questionId, input) => oneOnOnesApi.updateQuestion(id!, blockId, questionId, input),
    deleteQuestion: (blockId, questionId) => oneOnOnesApi.deleteQuestion(id!, blockId, questionId),
    reorderQuestions: (blockId, questionIds) => oneOnOnesApi.reorderQuestions(id!, blockId, questionIds),
  };

  async function loadTemplate(templateId: string) {
    setLoading(true);
    try {
      const res = await oneOnOnesApi.get(templateId);
      setTemplate(res.template);
      setTitle(res.template.title);
      setDescription(res.template.description ?? '');
      setBlocksDirty(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadTemplate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isNew || createdRef.current) return;
    createdRef.current = true;
    setError(null);
    oneOnOnesApi
      .create({ title: isTemplate ? 'Untitled template' : 'Untitled one-on-one', isTemplate })
      .then((res) => {
        navigate(`/one-on-ones/${res.template.id}/edit`, { replace: true });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to create template');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  useEffect(() => {
    setIsTemplateActive(isTemplate || !!template?.isTemplate);
    return () => setIsTemplateActive(false);
  }, [isTemplate, template?.isTemplate, setIsTemplateActive]);

  async function handleSaveDetails(e?: FormEvent) {
    e?.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await oneOnOnesApi.update(id, { title, description: description || undefined });
      if (blockListRef.current) {
        await blockListRef.current.flush();
      } else {
        await loadTemplate(id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleArchive() {
    if (!id || !template) return;
    setError(null);
    try {
      await oneOnOnesApi.update(id, { isArchived: !template.isArchived });
      await loadTemplate(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update template');
    }
  }

  async function handleTogglePublic() {
    if (!id || !template) return;
    setError(null);
    try {
      await oneOnOnesApi.update(id, { isPublic: !template.isPublic });
      await loadTemplate(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update sharing setting');
    }
  }

  async function handleCopyToMyTemplates() {
    if (!id) return;
    setError(null);
    try {
      const res = await oneOnOnesApi.duplicateTemplate(id, true);
      navigate(`/one-on-ones/${res.template.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to copy this template');
    }
  }

  function handleDiscardChanges() {
    if (!template) return;
    setTitle(template.title);
    setDescription(template.description ?? '');
    blockListRef.current?.discard();
  }

  async function handleDelete() {
    if (!id || !template) return;
    const warning = `Delete this ${template.isTemplate ? 'template' : 'one-on-one'}? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setError(null);
    try {
      await oneOnOnesApi.remove(id);
      navigate('/one-on-ones');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete');
    }
  }

  async function handleInitiate() {
    if (!id) return;
    setError(null);
    try {
      const res = await oneOnOnesApi.duplicateTemplate(id, false);
      navigate(`/one-on-ones/${res.template.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to initiate a one-on-one from this template');
    }
  }

  async function handlePublish() {
    if (!id) return;
    setError(null);
    try {
      await oneOnOnesApi.publish(id);
      await loadTemplate(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish');
    }
  }

  async function handleUnpublish() {
    if (!id) return;
    setError(null);
    try {
      await oneOnOnesApi.unpublish(id);
      await loadTemplate(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unpublish');
    }
  }

  async function handleStartRun(userId: string) {
    if (!id) return;
    setError(null);
    setRunStartedFor(null);
    setStartingRunFor(userId);
    try {
      await oneOnOnesApi.startRun(id, userId);
      setRunStartedFor(userId);
      await loadTemplate(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start a new 1:1');
    } finally {
      setStartingRunFor(null);
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
  if (!template) return <p className="form-error">{error ?? 'Template not found'}</p>;

  const isOwner = user?.role === 'ADMIN' || template.createdById === user?.id;
  const hasUnsavedChanges =
    title !== template.title || description !== (template.description ?? '') || blocksDirty;

  if (!isOwner) {
    return (
      <div className="page builder-layout">
        <div className="builder-main">
          <div className="page-header">
            <h1>{template.title}</h1>
            <span className="status-badge public">Public</span>
          </div>
          {template.description && <p>{template.description}</p>}
          <p className="muted">Public 1:1 template, read-only. Initiate it directly, or copy it to customize first.</p>

          {error && <p className="form-error">{error}</p>}

          <BlockList blocks={template.blocks} api={blockApi} editable={false} onChanged={() => {}} />

          <section className="survey-actions">
            <button onClick={handleInitiate} className="primary">
              Initiate a one-on-one
            </button>
            <button onClick={handleCopyToMyTemplates}>Copy to my templates</button>
          </section>
        </div>
        <BuilderPreviewPanel
          title={template.title}
          description={template.description}
          blocks={template.blocks}
          topNote={<p className="muted">This 1:1 is linked to your name and reviewed by your leader.</p>}
          submitLabel="Submit"
        />
      </div>
    );
  }

  const isEditableDetails = template.isTemplate || template.status === 'DRAFT';

  return (
    <div className="page builder-layout">
    <div className="builder-main">
      <div className="page-header">
        <h1>{template.title}</h1>
        {template.isTemplate ? (
          <>
            <span className="status-badge template">Template</span>
            {template.isPublic && <span className="status-badge public">Public</span>}
          </>
        ) : (
          <span className={`status-badge ${template.status.toLowerCase()}`}>{template.status}</span>
        )}
        {template.isArchived && <span className="status-badge closed">ARCHIVED</span>}
      </div>

      {isEditableDetails ? (
        <div className="survey-form">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <div className="survey-actions">
            <button type="button" onClick={handleToggleArchive}>
              {template.isArchived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {template.description && <p>{template.description}</p>}
          <p className="muted">
            This one-on-one is published — unpublish it to edit its title, description, questions, or blocks.
          </p>
          <div className="survey-actions">
            <button type="button" onClick={handleToggleArchive}>
              {template.isArchived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </>
      )}

      {error && <p className="form-error">{error}</p>}

      <p className="muted">
        Questions stay the same across every run so you can compare answers over time. Editing a question that
        already has responses is limited to protect trend history.
      </p>
      <BlockList
        ref={blockListRef}
        blocks={template.blocks}
        api={blockApi}
        editable={template.status === 'DRAFT'}
        deferSave={template.isTemplate}
        onDirtyChange={setBlocksDirty}
        onChanged={() => loadTemplate(id!)}
      />

      <section>
        <h2>Recipients ({template.recipients.length})</h2>
      </section>

      <section className="survey-actions">
        <Link to={`/one-on-ones/${id}/recipients`} className="button">
          Manage recipients
        </Link>
        {template.isTemplate ? (
          <>
            <button onClick={() => handleSaveDetails()} disabled={submitting || !hasUnsavedChanges}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleDiscardChanges} disabled={!hasUnsavedChanges}>
              Discard changes
            </button>
            <button onClick={handleTogglePublic}>{template.isPublic ? 'Make private' : 'Make public'}</button>
            <button onClick={handleDelete} className="danger">
              Delete template
            </button>
          </>
        ) : (
          <>
            {isEditableDetails && (
              <button onClick={() => handleSaveDetails()} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save details'}
              </button>
            )}
            {template.status === 'DRAFT' && (
              <button onClick={handlePublish} className="primary">
                Initiate one-on-one
              </button>
            )}
            {template.status === 'PUBLISHED' && <button onClick={handleUnpublish}>Unpublish to edit</button>}
          </>
        )}
      </section>

      <section>
        {template.recipients.length === 0 ? (
          <p className="empty-state">No recipients yet — add the people you run this 1:1 with.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Past runs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {template.recipients.map((r) => (
                <tr key={r.user.id}>
                  <td>
                    {r.user.name} <span className="muted">{r.user.email}</span>
                  </td>
                  <td>{r.runCount}</td>
                  <td className="actions">
                    {!template.isTemplate && template.status === 'PUBLISHED' && (
                      <button onClick={() => handleStartRun(r.user.id)} disabled={startingRunFor === r.user.id}>
                        {startingRunFor === r.user.id ? 'Starting...' : 'Start new 1:1'}
                      </button>
                    )}
                    {!template.isTemplate && template.status === 'DRAFT' && (
                      <span className="muted">Publish to start</span>
                    )}
                    {r.runCount > 0 && (
                      <Link to={`/one-on-ones/${id}/trend/${r.user.id}`} className="button">
                        View trend
                      </Link>
                    )}
                    {runStartedFor === r.user.id && <span className="muted">Started — they'll see it now.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
    <BuilderPreviewPanel
      title={template.title}
      description={template.description}
      blocks={template.blocks}
      topNote={<p className="muted">This 1:1 is linked to your name and reviewed by your leader.</p>}
      submitLabel="Submit"
    />
    </div>
  );
}
