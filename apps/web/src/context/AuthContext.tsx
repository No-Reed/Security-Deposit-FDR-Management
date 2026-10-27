import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, CurrentUser, setCsrfToken } from '../lib/api';

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isDemoMode: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  useEffect(() => {
    let mounted = true;
    api.auth.me()
      .then((current) => { if (mounted) setUser(current); })
      .catch(() => { if (mounted) { setUser(null); setCsrfToken(null); } })
      .finally(() => { if (mounted) setIsLoading(false); });
    api.auth.environment().then((environment) => {
      if (mounted) setIsDemoMode(environment.demo);
    }).catch(() => { /* No environment claims when the API is unavailable. */ });
    localStorage.removeItem('dd_demo_role');
    return () => { mounted = false; };
  }, []);
  const login = async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    setUser(data.user);
  };
  const logout = async () => {
    await api.auth.logout();
    setCsrfToken(null);
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, isLoading, login, logout, isDemoMode }}>{children}</AuthContext.Provider>;
};
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
