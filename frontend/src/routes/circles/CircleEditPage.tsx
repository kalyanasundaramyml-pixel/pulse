import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { circlesApi } from '../../api/circles';
import { DirectoryMember } from '../../types/api';
import { RecipientPicker } from '../../components/surveys/RecipientPicker';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/common/ToastProvider';

export function CircleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    circlesApi
      .get(id)
      .then((res) => {
        setName(res.circle.name);
        setMembers(res.circle.members);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load circle'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setError(null);
    setSaving(true);
    try {
      await circlesApi.update(id, { name, memberIds: members.map((m) => m.id) });
      showToast('Circle saved');
      navigate('/circles');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save circle');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="page">
      <h1>Edit circle</h1>
      <div className="survey-form">
        <label>
          Circle name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
      </div>
      <RecipientPicker selected={members} onChange={setMembers} />
      {error && <p className="form-error">{error}</p>}
      <button onClick={handleSave} disabled={saving || !name.trim()} className="primary">
        {saving ? 'Saving...' : 'Save circle'}
      </button>
    </div>
  );
}
