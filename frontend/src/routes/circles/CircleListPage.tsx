import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { circlesApi } from '../../api/circles';
import { CircleSummary } from '../../types/api';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/common/ToastProvider';

export function CircleListPage() {
  const { showToast } = useToast();
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await circlesApi.list();
      setCircles(result.circles);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load circles');
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
      await circlesApi.create({ name: newName.trim(), memberIds: [] });
      setNewName('');
      await load();
      showToast('Circle created');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create circle');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await circlesApi.remove(id);
      await load();
      showToast('Circle deleted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete circle');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Circles</h1>
      </div>
      <p className="muted">
        Circles are shared across all creators — anyone can add a circle's members to a survey's recipient list in
        one click.
      </p>
      <form className="search-bar" onSubmit={handleCreate}>
        <input placeholder="New circle name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" disabled={creating || !newName.trim()}>
          {creating ? 'Creating...' : 'Create circle'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : circles.length === 0 ? (
        <p className="empty-state">No circles yet.</p>
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
            {circles.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.memberCount}</td>
                <td className="actions">
                  <Link to={`/circles/${c.id}`} className="button">
                    Manage
                  </Link>
                  <button onClick={() => handleDelete(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
