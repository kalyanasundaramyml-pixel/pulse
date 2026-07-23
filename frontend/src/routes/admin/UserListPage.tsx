import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '../../api/users';
import { AdminUserRow, UserRole } from '../../types/api';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/common/ToastProvider';

const ROLES: UserRole[] = ['ADMIN', 'CREATOR', 'USER'];

export function UserListPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<{ id: string; tempPassword: string } | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{ name: string; email: string; tempPassword: string } | null>(
    null,
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await usersApi.list({ search: search || undefined });
      setUsers(result.users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRoleChange(id: string, role: UserRole) {
    await usersApi.update(id, { role });
    await load();
    showToast('Role updated');
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    await usersApi.update(id, { isActive: !isActive });
    await load();
    showToast(isActive ? 'User deactivated' : 'User activated');
  }

  async function handleResetPassword(id: string) {
    const result = await usersApi.resetPassword(id);
    setResetInfo({ id, tempPassword: result.tempPassword });
    showToast('Password reset');
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const result = await usersApi.create({ name: newName, email: newEmail, role: newRole });
      setCreatedUser({ name: result.user.name, email: result.user.email, tempPassword: result.tempPassword });
      setNewName('');
      setNewEmail('');
      setNewRole('USER');
      setShowCreateForm(false);
      load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Users</h1>
        <div className="actions">
          <button onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? 'Cancel' : 'Add user'}
          </button>
          <Link to="/admin/users/import" className="button">
            Import CSV
          </Link>
        </div>
      </div>
      {createdUser && (
        <p className="import-result">
          Created <strong>{createdUser.name}</strong> ({createdUser.email}). Temp password:{' '}
          <span className="temp-password">{createdUser.tempPassword}</span> &mdash; share it with them now, it
          will not be shown again.{' '}
          <button onClick={() => setCreatedUser(null)}>Dismiss</button>
        </p>
      )}
      {showCreateForm && (
        <form className="survey-form" onSubmit={handleCreateUser}>
          <label>
            Name
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          </label>
          <label>
            Role
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {createError && <p className="form-error">{createError}</p>}
          <button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create user'}
          </button>
        </form>
      )}
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit">Search</button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.isActive ? 'Active' : 'Deactivated'}</td>
                <td className="actions">
                  <button onClick={() => handleToggleActive(u.id, u.isActive)}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleResetPassword(u.id)}>Reset password</button>
                  {resetInfo?.id === u.id && (
                    <span className="temp-password">Temp password: {resetInfo.tempPassword}</span>
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
