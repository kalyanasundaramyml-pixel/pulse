import { useEffect, useState } from 'react';
import { membersApi } from '../../api/members';
import { circlesApi } from '../../api/circles';
import { DirectoryMember, CircleSummary } from '../../types/api';

export function RecipientPicker({
  selected,
  onChange,
  excludeMemberId,
}: {
  selected: DirectoryMember[];
  onChange: (selected: DirectoryMember[]) => void;
  excludeMemberId?: string;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState('');
  const [addingCircle, setAddingCircle] = useState(false);
  const [circleError, setCircleError] = useState<string | null>(null);

  useEffect(() => {
    circlesApi.list().then((res) => setCircles(res.circles));
  }, []);

  async function addCircleMembers() {
    if (!selectedCircleId) return;
    setCircleError(null);
    setAddingCircle(true);
    try {
      const { circle } = await circlesApi.get(selectedCircleId);
      const currentIds = new Set(selected.map((u) => u.id));
      const toAdd = circle.members.filter((m) => !currentIds.has(m.id) && m.id !== excludeMemberId);
      onChange([...selected, ...toAdd]);
    } catch {
      setCircleError('Failed to load circle members');
    } finally {
      setAddingCircle(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await membersApi.directory(search || undefined);
        if (!cancelled) setResults(res.members);
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

  function add(member: DirectoryMember) {
    if (!selectedIds.has(member.id)) {
      onChange([...selected, member]);
    }
  }

  function remove(memberId: string) {
    onChange(selected.filter((u) => u.id !== memberId));
  }

  return (
    <div className="recipient-picker">
      {circles.length > 0 && (
        <div className="circle-add-row">
          <select value={selectedCircleId} onChange={(e) => setSelectedCircleId(e.target.value)}>
            <option value="">Add everyone from a circle...</option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.memberCount})
              </option>
            ))}
          </select>
          <button type="button" onClick={addCircleMembers} disabled={!selectedCircleId || addingCircle}>
            {addingCircle ? 'Adding...' : "Add circle's members"}
          </button>
        </div>
      )}
      {circleError && <p className="form-error">{circleError}</p>}
      <input
        placeholder="Search people by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading && <p className="muted">Searching...</p>}
      <ul className="picker-results">
        {results
          .filter((u) => !selectedIds.has(u.id) && u.id !== excludeMemberId)
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
