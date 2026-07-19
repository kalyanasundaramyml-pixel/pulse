import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { surveysApi } from '../../api/surveys';
import { DirectoryUser } from '../../types/api';
import { RecipientPicker } from '../../components/surveys/RecipientPicker';
import { ApiError } from '../../api/client';

export function SurveyRecipientsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    surveysApi
      .get(id)
      .then((res) => setSelected(res.survey.recipients.map((r) => r.user)))
      .finally(() => setLoading(false));
  }, [id]);

  const [notice, setNotice] = useState<string | null>(null);

  async function handleSave() {
    if (!id) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const result = await surveysApi.setRecipients(
        id,
        selected.map((u) => u.id),
      );
      if (result?.protectedUserIds?.length) {
        setNotice(result.message);
      } else {
        navigate(`/surveys/${id}/edit`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save recipients');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="page">
      <h1>Manage recipients</h1>
      <RecipientPicker selected={selected} onChange={setSelected} />
      {error && <p className="form-error">{error}</p>}
      {notice && <p className="muted">{notice}</p>}
      <button onClick={handleSave} disabled={saving || selected.length === 0} className="primary">
        {saving ? 'Saving...' : 'Save recipients'}
      </button>
    </div>
  );
}
