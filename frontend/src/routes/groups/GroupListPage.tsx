import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { groupsApi } from '../../api/groups';
import { GroupSummary } from '../../types/api';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/common/ToastProvider';

export function GroupListPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await groupsApi.list();
      setGroups(result.groups);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await groupsApi.create({ name: newName.trim(), userIds: [] });
      setNewName('');
      await load();
      showToast('Group created');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await groupsApi.remove(id);
      await load();
      showToast('Group deleted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete group');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Groups</h1>
      </div>
      <p className="muted">
        Groups are shared across all creators — anyone can add a group's members to a survey's recipient list in one
        click.
      </p>
      <form className="search-bar" onSubmit={handleCreate}>
        <input placeholder="New group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" disabled={creating || !newName.trim()}>
          {creating ? 'Creating...' : 'Create group'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : groups.length === 0 ? (
        <p className="empty-state">No groups yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Members</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{g.memberCount}</td>
                <td className="actions">
                  <Link to={`/groups/${g.id}`} className="button">
                    Manage
                  </Link>
                  <button onClick={() => handleDelete(g.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
