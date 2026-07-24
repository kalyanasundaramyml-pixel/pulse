import { createContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { PublicMember } from '../types/api';

interface AuthContextValue {
  member: PublicMember | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<PublicMember | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { member } = await authApi.me();
      setMember(member);
    } catch {
      setMember(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { member } = await authApi.login(email, password);
    setMember(member);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setMember(null);
  }, []);

  return (
    <AuthContext.Provider value={{ member, loading, login, logout, refresh }}>{children}</AuthContext.Provider>
  );
}
