import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupsApi } from '../../api/groups';
import { DirectoryUser } from '../../types/api';
import { RecipientPicker } from '../../components/surveys/RecipientPicker';
import { ApiError } from '../../api/client';

export function GroupEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    groupsApi
      .get(id)
      .then((res) => {
        setName(res.group.name);
        setMembers(res.group.members);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load group'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setError(null);
    setSaving(true);
    try {
      await groupsApi.update(id, { name, userIds: members.map((m) => m.id) });
      navigate('/groups');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save group');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="page">
      <h1>Edit group</h1>
      <div className="survey-form">
        <label>
          Group name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
      </div>
      <RecipientPicker selected={members} onChange={setMembers} />
      {error && <p className="form-error">{error}</p>}
      <button onClick={handleSave} disabled={saving || !name.trim()} className="primary">
        {saving ? 'Saving...' : 'Save group'}
      </button>
    </div>
  );
}
