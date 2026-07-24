import { FormEvent, useEffect, useState } from 'react';
import { groupsApi } from '../../api/groups';
import { Group } from '../../types/api';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/common/ToastProvider';

export function GroupListPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
      await groupsApi.create(newName.trim());
      setNewName('');
      await load();
      showToast('Group created');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }

  function startRename(group: Group) {
    setRenamingId(group.id);
    setRenameValue(group.name);
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    setError(null);
    try {
      await groupsApi.rename(id, renameValue.trim());
      setRenamingId(null);
      await load();
      showToast('Group renamed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to rename group');
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
        Groups are org teams — every member belongs to exactly one. Assign a member to a group from the Admin member
        list.
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
                <td>
                  {renamingId === g.id ? (
                    <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                  ) : (
                    <>
                      {g.name} {g.isDefault && <span className="status-badge">Default</span>}
                    </>
                  )}
                </td>
                <td>{g.memberCount}</td>
                <td className="actions">
                  {renamingId === g.id ? (
                    <>
                      <button onClick={() => handleRename(g.id)}>Save</button>
                      <button onClick={() => setRenamingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startRename(g)}>Rename</button>
                      {!g.isDefault && (
                        <button onClick={() => handleDelete(g.id)} disabled={g.memberCount > 0}>
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
