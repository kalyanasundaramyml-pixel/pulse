import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { MemberRole } from '../../types/api';

export function ProtectedRoute({ roles }: { roles?: MemberRole[] }) {
  const { member, loading } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }
  if (!member) {
    return <Navigate to="/login" replace />;
  }
  if (member.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(member.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
