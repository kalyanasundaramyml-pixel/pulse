import { useCallback } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { TemplateNavProvider, useTemplateNav } from '../../hooks/useTemplateNav';
import { UnsavedChangesProvider, useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function useGuardedNavClick() {
  const { confirmNavigation } = useUnsavedChangesGuard();
  return useCallback(
    (e: React.MouseEvent) => {
      if (!confirmNavigation()) e.preventDefault();
    },
    [confirmNavigation],
  );
}

function AppNav() {
  const { member } = useAuth();
  const { isTemplateActive } = useTemplateNav();
  const guardedClick = useGuardedNavClick();

  return (
    <nav className="app-nav">
      <NavLink to="/surveys" onClick={guardedClick} className={({ isActive }) => (isActive && !isTemplateActive ? 'active' : '')}>
        Surveys
      </NavLink>
      <NavLink to="/one-on-ones" onClick={guardedClick} className={({ isActive }) => (isActive && !isTemplateActive ? 'active' : '')}>
        One-on-Ones
      </NavLink>
      {(member?.role === 'CREATOR' || member?.role === 'AUDITOR' || member?.role === 'ADMIN') && (
        <NavLink to="/templates" onClick={guardedClick} className={({ isActive }) => (isActive || isTemplateActive ? 'active' : '')}>
          Templates
        </NavLink>
      )}
      {(member?.role === 'CREATOR' || member?.role === 'AUDITOR' || member?.role === 'ADMIN') && (
        <NavLink to="/circles" onClick={guardedClick} className={({ isActive }) => (isActive ? 'active' : '')}>
          Circles
        </NavLink>
      )}
      {member?.role === 'ADMIN' && (
        <NavLink to="/admin/members" onClick={guardedClick} className={({ isActive }) => (isActive ? 'active' : '')}>
          Admin
        </NavLink>
      )}
      {member?.role === 'ADMIN' && (
        <NavLink to="/admin/groups" onClick={guardedClick} className={({ isActive }) => (isActive ? 'active' : '')}>
          Groups
        </NavLink>
      )}
      <NavLink to="/help" onClick={guardedClick} className={({ isActive }) => (isActive ? 'active' : '')}>
        Help
      </NavLink>
    </nav>
  );
}

function AppHeaderMember() {
  const { member, logout } = useAuth();
  const { confirmNavigation } = useUnsavedChangesGuard();
  return (
    <div className="app-header-member">
      <span className="avatar">{initials(member?.name)}</span>
      <span className="app-header-member-name">{member?.name}</span>
      <span className="role-badge">{member?.role}</span>
      <button
        onClick={() => {
          if (confirmNavigation()) logout();
        }}
      >
        Log out
      </button>
    </div>
  );
}

export function AppShell() {
  return (
    <UnsavedChangesProvider>
      <TemplateNavProvider>
        <div className="app-shell">
          <header className="app-header">
            <div className="app-logo">
              <span className="app-logo-mark">
                <svg width="26" height="26" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M 10 50 L 30 50 L 35 40 L 42 60 L 50 15 L 58 85 L 65 40 L 70 50 L 90 50"
                    stroke="#A0522D"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="app-header-title">Pulse</span>
            </div>
            <AppNav />
            <AppHeaderMember />
          </header>
          <main className="app-main">
            <Outlet />
          </main>
        </div>
      </TemplateNavProvider>
    </UnsavedChangesProvider>
  );
}
