import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { membersApi } from '../../api/members';
import { groupsApi } from '../../api/groups';
import { AdminMemberRow, Group, MemberRole } from '../../types/api';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/common/ToastProvider';

const ROLES: MemberRole[] = ['ADMIN', 'CREATOR', 'AUDITOR', 'MEMBER'];

export function MemberListPage() {
  const { showToast } = useToast();
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<{ id: string; tempPassword: string } | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('MEMBER');
  const [newGroupId, setNewGroupId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdMember, setCreatedMember] = useState<{ name: string; email: string; tempPassword: string } | null>(
    null,
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await membersApi.list({ search: search || undefined });
      setMembers(result.members);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    groupsApi.list().then((res) => {
      setGroups(res.groups);
      const defaultGroup = res.groups.find((g) => g.isDefault);
      if (defaultGroup) setNewGroupId(defaultGroup.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRoleChange(id: string, role: MemberRole) {
    await membersApi.update(id, { role });
    await load();
    showToast('Role updated');
  }

  async function handleGroupChange(id: string, groupId: string) {
    await membersApi.update(id, { groupId });
    await load();
    showToast('Group updated');
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    await membersApi.update(id, { isActive: !isActive });
    await load();
    showToast(isActive ? 'Member deactivated' : 'Member activated');
  }

  async function handleResetPassword(id: string) {
    const result = await membersApi.resetPassword(id);
    setResetInfo({ id, tempPassword: result.tempPassword });
    showToast('Password reset');
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const result = await membersApi.create({
        name: newName,
        email: newEmail,
        role: newRole,
        groupId: newGroupId || undefined,
      });
      setCreatedMember({ name: result.member.name, email: result.member.email, tempPassword: result.tempPassword });
      setNewName('');
      setNewEmail('');
      setNewRole('MEMBER');
      setShowCreateForm(false);
      load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create member');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Members</h1>
        <div className="actions">
          <button onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? 'Cancel' : 'Add member'}
          </button>
          <Link to="/admin/members/import" className="button">
            Import CSV
          </Link>
        </div>
      </div>
      {createdMember && (
        <p className="import-result">
          Created <strong>{createdMember.name}</strong> ({createdMember.email}). Temp password:{' '}
          <span className="temp-password">{createdMember.tempPassword}</span> &mdash; share it with them now, it
          will not be shown again.{' '}
          <button onClick={() => setCreatedMember(null)}>Dismiss</button>
        </p>
      )}
      {showCreateForm && (
        <form className="survey-form" onSubmit={handleCreateMember}>
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
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as MemberRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Group
            <select value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          {createError && <p className="form-error">{createError}</p>}
          <button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create member'}
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
              <th>Group</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>
                  <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={m.group.id} onChange={(e) => handleGroupChange(m.id, e.target.value)}>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{m.isActive ? 'Active' : 'Deactivated'}</td>
                <td className="actions">
                  <button onClick={() => handleToggleActive(m.id, m.isActive)}>
                    {m.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleResetPassword(m.id)}>Reset password</button>
                  {resetInfo?.id === m.id && (
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
