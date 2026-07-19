import { useEffect, useState } from 'react';
import { usersApi } from '../../api/users';
import { groupsApi } from '../../api/groups';
import { DirectoryUser, GroupSummary } from '../../types/api';

export function RecipientPicker({
  selected,
  onChange,
  excludeUserId,
}: {
  selected: DirectoryUser[];
  onChange: (selected: DirectoryUser[]) => void;
  excludeUserId?: string;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  useEffect(() => {
    groupsApi.list().then((res) => setGroups(res.groups));
  }, []);

  async function addGroupMembers() {
    if (!selectedGroupId) return;
    setGroupError(null);
    setAddingGroup(true);
    try {
      const { group } = await groupsApi.get(selectedGroupId);
      const currentIds = new Set(selected.map((u) => u.id));
      const toAdd = group.members.filter((m) => !currentIds.has(m.id) && m.id !== excludeUserId);
      onChange([...selected, ...toAdd]);
    } catch {
      setGroupError('Failed to load group members');
    } finally {
      setAddingGroup(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await usersApi.directory(search || undefined);
        if (!cancelled) setResults(res.users);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const selectedIds = new Set(selected.map((u) => u.id));

  function add(user: DirectoryUser) {
    if (!selectedIds.has(user.id)) {
      onChange([...selected, user]);
    }
  }

  function remove(userId: string) {
    onChange(selected.filter((u) => u.id !== userId));
  }

  return (
    <div className="recipient-picker">
      {groups.length > 0 && (
        <div className="group-add-row">
          <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
            <option value="">Add everyone from a group...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.memberCount})
              </option>
            ))}
          </select>
          <button type="button" onClick={addGroupMembers} disabled={!selectedGroupId || addingGroup}>
            {addingGroup ? 'Adding...' : "Add group's members"}
          </button>
        </div>
      )}
      {groupError && <p className="form-error">{groupError}</p>}
      <input
        placeholder="Search employees by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading && <p className="muted">Searching...</p>}
      <ul className="picker-results">
        {results
          .filter((u) => !selectedIds.has(u.id) && u.id !== excludeUserId)
          .map((u) => (
            <li key={u.id}>
              <span>
                {u.name} <span className="muted">{u.email}</span>
              </span>
              <button type="button" onClick={() => add(u)}>
                Add
              </button>
            </li>
          ))}
      </ul>
      <h4>Selected recipients ({selected.length})</h4>
      <ul className="picker-selected">
        {selected.map((u) => (
          <li key={u.id}>
            <span>
              {u.name} <span className="muted">{u.email}</span>
            </span>
            <button type="button" onClick={() => remove(u.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
