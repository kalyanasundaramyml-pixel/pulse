import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { DirectoryUser } from '../../types/api';
import { RecipientPicker } from '../../components/surveys/RecipientPicker';
import { ApiError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/common/ToastProvider';

export function OneOnOneRecipientsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    oneOnOnesApi
      .get(id)
      .then((res) => setSelected(res.template.recipients.map((r) => r.user)))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setError(null);
    setSaving(true);
    try {
      await oneOnOnesApi.setRecipients(
        id,
        selected.map((u) => u.id),
      );
      showToast('Recipients saved');
      navigate(`/one-on-ones/${id}/edit`);
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
      <p className="muted">The people you run this 1:1 template with. You can start a new 1:1 for anyone on this list.</p>
      <RecipientPicker selected={selected} onChange={setSelected} excludeUserId={user?.id} />
      {error && <p className="form-error">{error}</p>}
      <button onClick={handleSave} disabled={saving} className="primary">
        {saving ? 'Saving...' : 'Save recipients'}
      </button>
    </div>
  );
}
