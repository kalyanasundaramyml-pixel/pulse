import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { TemplateNavProvider, useTemplateNav } from '../../hooks/useTemplateNav';

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function AppNav() {
  const { user } = useAuth();
  const { isTemplateActive } = useTemplateNav();

  return (
    <nav className="app-nav">
      <NavLink to="/surveys" className={({ isActive }) => (isActive && !isTemplateActive ? 'active' : '')}>
        Surveys
      </NavLink>
      <NavLink to="/one-on-ones" className={({ isActive }) => (isActive && !isTemplateActive ? 'active' : '')}>
        One-on-Ones
      </NavLink>
      {(user?.role === 'LEADER' || user?.role === 'ADMIN') && (
        <NavLink to="/templates" className={({ isActive }) => (isActive || isTemplateActive ? 'active' : '')}>
          Templates
        </NavLink>
      )}
      {(user?.role === 'LEADER' || user?.role === 'ADMIN') && (
        <NavLink to="/groups" className={({ isActive }) => (isActive ? 'active' : '')}>
          Groups
        </NavLink>
      )}
      {user?.role === 'ADMIN' && (
        <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
          Admin
        </NavLink>
      )}
    </nav>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <TemplateNavProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-logo">
            <span className="app-logo-mark">
              <svg width="17" height="17" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M28,100 L58,100 L70,74 L82,126 L94,44 L106,156 L118,100 L172,100"
                  stroke="currentColor"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="app-header-title">Pulse</span>
          </div>
          <AppNav />
          <div className="app-header-user">
            <span className="avatar">{initials(user?.name)}</span>
            <span className="app-header-user-name">{user?.name}</span>
            <span className="role-badge">{user?.role}</span>
            <button onClick={() => logout()}>Log out</button>
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </TemplateNavProvider>
  );
}
