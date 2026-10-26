import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role } from '@depositdesk/shared';
import { api, CurrentUser, setCsrfToken } from '../lib/api';

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoRole: (role: Role) => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo fallback profiles
const DEMO_PROFILES: Record<Role, CurrentUser> = {
  [Role.INSTITUTION_USER]: {
    id: 'demo-iu-id',
    name: 'Dr. Ramesh Sharma (Registrar)',
    email: 'iu@demo.aicte.gov.in',
    role: Role.INSTITUTION_USER,
    institutionId: 'demo-inst-1',
    institution: {
      id: 'demo-inst-1',
      name: 'Delhi Institute of Engineering & Technology',
      aicteId: '1-10293847',
    },
    lastLoginAt: new Date().toISOString(),
  },
  [Role.SCRUTINY_OFFICER]: {
    id: 'demo-so-id',
    name: 'Ananya Verma (Scrutiny Officer)',
    email: 'so@demo.aicte.gov.in',
    role: Role.SCRUTINY_OFFICER,
    lastLoginAt: new Date().toISOString(),
  },
  [Role.APPROVING_AUTHORITY]: {
    id: 'demo-aa-id',
    name: 'Prof. K. S. Sundaram (Regional Officer)',
    email: 'aa@demo.aicte.gov.in',
    role: Role.APPROVING_AUTHORITY,
    lastLoginAt: new Date().toISOString(),
  },
  [Role.SYSTEM_ADMIN]: {
    id: 'demo-sa-id',
    name: 'Vikram Mehta (AICTE Admin)',
    email: 'admin@demo.aicte.gov.in',
    role: Role.SYSTEM_ADMIN,
    lastLoginAt: new Date().toISOString(),
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isDemoMode = true;

  // On mount check session
  useEffect(() => {
    let isMounted = true;
    api.auth
      .me()
      .then((currUser) => {
        if (isMounted) setUser(currUser);
      })
      .catch(() => {
        // Fall back to saved demo role in localStorage if offline/demo
        const savedRole = localStorage.getItem('dd_demo_role') as Role;
        if (savedRole && DEMO_PROFILES[savedRole]) {
          if (isMounted) setUser(DEMO_PROFILES[savedRole]);
        } else {
          // Default demo role for smooth first impression: Institution User
          if (isMounted) setUser(DEMO_PROFILES[Role.INSTITUTION_USER]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password = 'DemoPassword123!') => {
    setIsLoading(true);
    try {
      const data = await api.auth.login(email, password);
      setUser(data.user);
      localStorage.setItem('dd_demo_role', data.user.role);
    } catch (err) {
      // If backend is not reached, simulate login with matching demo profile
      const matched = Object.values(DEMO_PROFILES).find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        setUser(matched);
        localStorage.setItem('dd_demo_role', matched.role);
      } else {
        throw err;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } catch {
      // ignore
    } finally {
      setUser(null);
      setCsrfToken(null);
      localStorage.removeItem('dd_demo_role');
      setIsLoading(false);
    }
  };

  const switchDemoRole = async (role: Role) => {
    const target = DEMO_PROFILES[role];
    if (!target) return;
    try {
      await login(target.email, 'DemoPassword123!');
    } catch {
      setUser(target);
      localStorage.setItem('dd_demo_role', target.role);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, switchDemoRole, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
