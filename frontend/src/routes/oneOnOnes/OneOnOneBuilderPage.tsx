import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { QuestionInput } from '../../api/surveys';
import { OneOnOneTemplateDetail, Question } from '../../types/api';
import { ApiError } from '../../api/client';
import { QuestionEditor } from '../../components/surveys/QuestionEditor';
import { useAuth } from '../../hooks/useAuth';

export function OneOnOneBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id;

  const [template, setTemplate] = useState<OneOnOneTemplateDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [startingRunFor, setStartingRunFor] = useState<string | null>(null);
  const [runStartedFor, setRunStartedFor] = useState<string | null>(null);

  async function loadTemplate(templateId: string) {
    setLoading(true);
    try {
      const res = await oneOnOnesApi.get(templateId);
      setTemplate(res.template);
      setTitle(res.template.title);
      setDescription(res.template.description ?? '');
      setEditingQuestion(null);
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await oneOnOnesApi.create({ title, description: description || undefined });
      navigate(`/one-on-ones/${res.template.id}/edit`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create template');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await oneOnOnesApi.update(id, { title, description: description || undefined });
      await loadTemplate(id);
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
      const res = await oneOnOnesApi.duplicateTemplate(id);
      navigate(`/one-on-ones/${res.template.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to copy this template');
    }
  }

  async function handleAddQuestion(input: QuestionInput) {
    if (!id) return;
    await oneOnOnesApi.addQuestion(id, input);
    await loadTemplate(id);
  }

  async function handleUpdateQuestion(input: QuestionInput) {
    if (!id || !editingQuestion) return;
    await oneOnOnesApi.updateQuestion(id, editingQuestion.id, input);
    await loadTemplate(id);
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!id) return;
    setError(null);
    try {
      await oneOnOnesApi.deleteQuestion(id, questionId);
      await loadTemplate(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete question');
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
        <h1>New 1:1 template</h1>
        <form className="survey-form" onSubmit={handleCreate}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Monthly 1:1" />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create template'}
          </button>
        </form>
      </div>
    );
  }

  if (loading) return <p>Loading...</p>;
  if (!template) return <p className="form-error">{error ?? 'Template not found'}</p>;

  const isOwner = user?.role === 'ADMIN' || template.createdById === user?.id;

  if (!isOwner) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>{template.title}</h1>
          <span className="status-badge public">Public</span>
        </div>
        {template.description && <p>{template.description}</p>}
        <p className="muted">Public 1:1 template, read-only. Copy it to add your own recipients and run it.</p>

        {error && <p className="form-error">{error}</p>}

        <section>
          <h2>Questions ({template.questions.length})</h2>
          <ul className="question-list">
            {template.questions.map((q) => (
              <li key={q.id}>
                <span className="question-type-tag">{q.questionType}</span>
                <span>{q.prompt}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="survey-actions">
          <button onClick={handleCopyToMyTemplates} className="primary">
            Copy to my templates
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{template.title}</h1>
        {template.isArchived && <span className="status-badge closed">ARCHIVED</span>}
        {template.isPublic && <span className="status-badge public">Public</span>}
      </div>

      <form className="survey-form" onSubmit={handleSaveDetails}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <div className="survey-actions">
          <button type="submit" disabled={submitting}>
            Save details
          </button>
          <button type="button" onClick={handleToggleArchive}>
            {template.isArchived ? 'Unarchive' : 'Archive'}
          </button>
          <button type="button" onClick={handleTogglePublic}>
            {template.isPublic ? 'Make private' : 'Make public'}
          </button>
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}

      <section>
        <h2>Questions ({template.questions.length})</h2>
        <p className="muted">
          These stay the same across every run so you can compare answers over time. Editing a question that already
          has responses is limited to protect trend history.
        </p>
        <ul className="question-list">
          {template.questions.map((q) => (
            <li key={q.id}>
              <span className="question-type-tag">{q.questionType}</span>
              <span>{q.prompt}</span>
              <button onClick={() => setEditingQuestion(q)}>Edit</button>
              <button onClick={() => handleDeleteQuestion(q.id)}>Delete</button>
            </li>
          ))}
        </ul>
        {editingQuestion ? (
          <QuestionEditor
            key={editingQuestion.id}
            existingQuestion={editingQuestion}
            onSubmit={handleUpdateQuestion}
            onCancel={() => setEditingQuestion(null)}
          />
        ) : (
          <QuestionEditor onSubmit={handleAddQuestion} />
        )}
      </section>

      <section>
        <div className="page-header">
          <h2>Recipients ({template.recipients.length})</h2>
          <Link to={`/one-on-ones/${id}/recipients`} className="button">
            Manage recipients
          </Link>
        </div>
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
                    <button onClick={() => handleStartRun(r.user.id)} disabled={startingRunFor === r.user.id}>
                      {startingRunFor === r.user.id ? 'Starting...' : 'Start new 1:1'}
                    </button>
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
  );
}
