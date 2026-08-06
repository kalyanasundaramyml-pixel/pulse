import { useEffect, useRef, useState } from 'react';
import { Link, NavigateOptions, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { OneOnOneTemplateDetail } from '../../types/api';
import { DraftBlock } from '../../types/draft';
import { blockToDraft, blocksToPayload, validateDraftBlocks } from '../../lib/draft';
import { ApiError } from '../../api/client';
import { BlockList } from '../../components/surveys/BlockList';
import { BuilderPreviewPanel } from '../../components/surveys/BuilderPreviewPanel';
import { useAuth } from '../../hooks/useAuth';
import { useTemplateNav } from '../../hooks/useTemplateNav';
import { useRegisterUnsavedGuard, useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { getOneOnOneListView, oneOnOneListViewLabel } from '../../hooks/listView';
import { useToast } from '../../components/common/ToastProvider';

export function OneOnOneBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirmNavigation } = useUnsavedChangesGuard();
  const { member } = useAuth();
  const { showToast } = useToast();
  const { setIsTemplateActive } = useTemplateNav();
  const [searchParams] = useSearchParams();
  const isNew = !id;
  const [isTemplate] = useState(searchParams.get('type') === 'template');

  const [template, setTemplate] = useState<OneOnOneTemplateDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [draftBlocks, setDraftBlocks] = useState<DraftBlock[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startingRunFor, setStartingRunFor] = useState<string | null>(null);
  const [runStartedFor, setRunStartedFor] = useState<string | null>(null);
  const createdRef = useRef(false);

  function guardedNavigate(to: string, opts?: NavigateOptions) {
    if (confirmNavigation()) navigate(to, opts);
  }

  async function loadTemplate(templateId: string) {
    setLoading(true);
    try {
      const res = await oneOnOnesApi.get(templateId);
      setTemplate(res.template);
      setTitle(res.template.title);
      setDescription(res.template.description ?? '');
      setDraftBlocks(res.template.blocks.map(blockToDraft));
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

  const hasUnsavedChanges =
    !!template &&
    (title !== template.title ||
      description !== (template.description ?? '') ||
      JSON.stringify(blocksToPayload(draftBlocks)) !==
        JSON.stringify(blocksToPayload(template.blocks.map(blockToDraft))));

  useRegisterUnsavedGuard(hasUnsavedChanges);

  async function handleSave(): Promise<boolean> {
    if (!id) return false;
    const draftErrors = validateDraftBlocks(draftBlocks);
    if (!title.trim()) draftErrors.unshift('Title is required');
    if (draftErrors.length) {
      setError(draftErrors.join(' '));
      return false;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await oneOnOnesApi.saveDraft(id, {
        title,
        description: description || undefined,
        blocks: blocksToPayload(draftBlocks),
      });
      setTemplate(res.template);
      setDraftBlocks(res.template.blocks.map(blockToDraft));
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleArchive() {
    if (!id || !template) return;
    setError(null);
    try {
      const nextIsArchived = !template.isArchived;
      await oneOnOnesApi.update(id, { isArchived: nextIsArchived });
      await loadTemplate(id);
      showToast(nextIsArchived ? 'Archived' : 'Unarchived');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update template');
    }
  }

  async function handleTogglePublic() {
    if (!id || !template) return;
    setError(null);
    if (!(await handleSave())) return;
    try {
      const nextIsPublic = !template.isPublic;
      await oneOnOnesApi.update(id, { isPublic: nextIsPublic });
      await loadTemplate(id);
      showToast(nextIsPublic ? 'Made public' : 'Made private');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update sharing setting');
    }
  }

  async function handleCopyToMyTemplates() {
    if (!id) return;
    setError(null);
    try {
      const res = await oneOnOnesApi.duplicateTemplate(id, true);
      showToast('Template copied to your templates');
      guardedNavigate(`/one-on-ones/${res.template.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to copy this template');
    }
  }

  function handleDiscardChanges() {
    if (!template) return;
    setTitle(template.title);
    setDescription(template.description ?? '');
    setDraftBlocks(template.blocks.map(blockToDraft));
    showToast('Changes discarded');
  }

  async function handleDelete() {
    if (!id || !template) return;
    const warning = `Delete this ${template.isTemplate ? 'template' : 'one-on-one'}? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setError(null);
    try {
      await oneOnOnesApi.remove(id);
      showToast(`${template.isTemplate ? 'Template' : 'One-on-one'} deleted`);
      guardedNavigate(template.isTemplate ? '/templates/one-on-ones' : '/one-on-ones');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete');
    }
  }

  async function handleInitiate() {
    if (!id) return;
    setError(null);
    try {
      const res = await oneOnOnesApi.duplicateTemplate(id, false);
      showToast('One-on-one initiated from template');
      guardedNavigate(`/one-on-ones/${res.template.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to initiate a one-on-one from this template');
    }
  }

  async function handlePublish() {
    if (!id) return;
    setError(null);
    if (!(await handleSave())) return;
    try {
      await oneOnOnesApi.publish(id);
      await loadTemplate(id);
      showToast('Published');
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
      showToast('Unpublished — you can edit it again');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unpublish');
    }
  }

  async function handleStartRun(memberId: string) {
    if (!id) return;
    setError(null);
    setRunStartedFor(null);
    setStartingRunFor(memberId);
    try {
      await oneOnOnesApi.startRun(id, memberId);
      setRunStartedFor(memberId);
      await loadTemplate(id);
      showToast('New 1:1 started');
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

  const isOwner = member?.role === 'ADMIN' || template.createdById === member?.id;
  const isAuditorViewer = member?.role === 'AUDITOR' && !isOwner;
  const isDraft = template.status === 'DRAFT';

  const backLink = template.isTemplate ? (
    <Link
      to="/templates/one-on-ones"
      className="back-link"
      onClick={(e) => {
        if (!confirmNavigation()) e.preventDefault();
      }}
    >
      ← Back to 1:1 templates
    </Link>
  ) : (
    <Link
      to="/one-on-ones?tab=initiated"
      className="back-link"
      onClick={(e) => {
        if (!confirmNavigation()) e.preventDefault();
      }}
    >
      ← Back to {oneOnOneListViewLabel({ ...getOneOnOneListView(), tab: 'initiated' })}
    </Link>
  );

  if (isAuditorViewer) {
    return (
      <div className="page builder-layout">
        <div className="builder-main">
          {backLink}
          <div className="page-header">
            <h1>{template.title}</h1>
            <span className={`status-badge ${template.status.toLowerCase()}`}>{template.status}</span>
          </div>
          {template.description && <p>{template.description}</p>}
          <p className="muted">Audit view — read-only oversight of a 1:1 created within your group.</p>

          {error && <p className="form-error">{error}</p>}

          <BlockList blocks={template.blocks.map(blockToDraft)} editable={false} onChange={() => {}} />

          <section>
            <h2>Recipients ({template.recipients.length})</h2>
            {template.recipients.length === 0 ? (
              <p className="empty-state">No recipients yet.</p>
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
                    <tr key={r.member.id}>
                      <td>
                        {r.member.name} <span className="muted">{r.member.email}</span>
                      </td>
                      <td>{r.runCount}</td>
                      <td className="actions">
                        {r.runCount > 0 && (
                          <Link to={`/one-on-ones/${id}/trend/${r.member.id}`} className="button">
                            View trend
                          </Link>
                        )}
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
          blocks={template.blocks.map(blockToDraft)}
          topNote={<p className="muted">This 1:1 is linked to your name and reviewed by your creator.</p>}
          submitLabel="Submit"
        />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page builder-layout">
        <div className="builder-main">
          {backLink}
          <div className="page-header">
            <h1>{template.title}</h1>
            <span className="status-badge public">Public</span>
          </div>
          {template.description && <p>{template.description}</p>}
          <p className="muted">Public 1:1 template, read-only. Initiate it directly, or copy it to customize first.</p>

          {error && <p className="form-error">{error}</p>}

          <BlockList blocks={template.blocks.map(blockToDraft)} editable={false} onChange={() => {}} />

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
          blocks={template.blocks.map(blockToDraft)}
          topNote={<p className="muted">This 1:1 is linked to your name and reviewed by your creator.</p>}
          submitLabel="Submit"
        />
      </div>
    );
  }

  return (
    <div className="page builder-layout">
    <div className="builder-main">
      {backLink}
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

      {isDraft ? (
        <div className="survey-form">
          {submitting && <p className="muted">Saving...</p>}
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
        </div>
      ) : (
        <>
          {template.description && <p>{template.description}</p>}
          <p className="muted">
            This one-on-one is published — unpublish it to edit its title, description, questions, or blocks.
          </p>
        </>
      )}

      {error && <p className="form-error">{error}</p>}

      <p className="muted">
        Questions stay the same across every run so you can compare answers over time. Editing a question that
        already has responses is limited to protect trend history.
      </p>
      <BlockList blocks={draftBlocks} editable={isDraft} onChange={setDraftBlocks} />

      <section>
        <h2>Recipients ({template.recipients.length})</h2>
      </section>

      <section className="survey-actions">
        <Link to={`/one-on-ones/${id}/recipients`} className="button">
          Manage recipients
        </Link>
        {isDraft && (
          <>
            <button
              onClick={async () => {
                if (await handleSave()) showToast('Changes saved');
              }}
              disabled={submitting || !hasUnsavedChanges}
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleDiscardChanges} disabled={!hasUnsavedChanges}>
              Discard changes
            </button>
          </>
        )}
        {template.isTemplate ? (
          <>
            <button onClick={handleTogglePublic}>{template.isPublic ? 'Make private' : 'Make public'}</button>
            <button type="button" onClick={handleToggleArchive}>
              {template.isArchived ? 'Unarchive' : 'Archive'}
            </button>
            <button onClick={handleDelete} className="danger">
              Delete template
            </button>
          </>
        ) : (
          <>
            {template.status === 'DRAFT' && (
              <button onClick={handlePublish} className="primary">
                Initiate one-on-one
              </button>
            )}
            {template.status === 'PUBLISHED' && <button onClick={handleUnpublish}>Unpublish to edit</button>}
            <button type="button" onClick={handleToggleArchive}>
              {template.isArchived ? 'Unarchive' : 'Archive'}
            </button>
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
                <tr key={r.member.id}>
                  <td>
                    {r.member.name} <span className="muted">{r.member.email}</span>
                  </td>
                  <td>{r.runCount}</td>
                  <td className="actions">
                    {!template.isTemplate && template.status === 'PUBLISHED' && (
                      <button onClick={() => handleStartRun(r.member.id)} disabled={startingRunFor === r.member.id}>
                        {startingRunFor === r.member.id ? 'Starting...' : 'Start new 1:1'}
                      </button>
                    )}
                    {!template.isTemplate && template.status === 'DRAFT' && (
                      <span className="muted">Publish to start</span>
                    )}
                    {r.runCount > 0 && (
                      <Link to={`/one-on-ones/${id}/trend/${r.member.id}`} className="button">
                        View trend
                      </Link>
                    )}
                    {runStartedFor === r.member.id && <span className="muted">Started — they'll see it now.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
    <BuilderPreviewPanel
      title={title}
      description={description}
      blocks={draftBlocks}
      topNote={<p className="muted">This 1:1 is linked to your name and reviewed by your creator.</p>}
      submitLabel="Submit"
    />
    </div>
  );
}
