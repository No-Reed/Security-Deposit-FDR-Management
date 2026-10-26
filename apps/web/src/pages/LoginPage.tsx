import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Role } from '@depositdesk/shared';
import { useAuth } from '../context/AuthContext';
import { Shield, ArrowRight, Lock, Mail, Sparkles, Building, UserCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('iu@demo.aicte.gov.in');
  const [password, setPassword] = useState('DemoPassword123!');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError('Invalid credentials or account locked. You can use the 1-click demo logins below.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (role: Role) => {
    setIsLoading(true);
    try {
      await switchDemoRole(role);
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const demoAccounts = [
    {
      role: Role.INSTITUTION_USER,
      title: 'Institution User',
      subtitle: 'Dr. Ramesh Sharma · Registrar',
      badge: 'IU',
      desc: 'Submit new FDRs, upload receipts, view maturities, request release upon course closure.',
      color: 'border-blue-200 hover:border-blue-400 bg-blue-50/30',
    },
    {
      role: Role.SCRUTINY_OFFICER,
      title: 'Scrutiny Officer',
      subtitle: 'Ananya Verma · Scrutiny Officer',
      badge: 'SO',
      desc: 'Examine submissions, record bank verification letters, flag deficiencies, review releases.',
      color: 'border-amber-200 hover:border-amber-400 bg-amber-50/30',
    },
    {
      role: Role.APPROVING_AUTHORITY,
      title: 'Approving Authority',
      subtitle: 'Prof. K. S. Sundaram · Regional Officer',
      badge: 'AA',
      desc: 'Competent authority: Maker-checker final sign-off, approve/reject FDR discharge orders.',
      color: 'border-purple-200 hover:border-purple-400 bg-purple-50/30',
    },
    {
      role: Role.SYSTEM_ADMIN,
      title: 'System Administrator',
      subtitle: 'Vikram Mehta · AICTE HQ Admin',
      badge: 'SA',
      desc: 'Configure alert thresholds, trigger midnight maturity jobs on-demand, manage users.',
      color: 'border-slate-200 hover:border-slate-400 bg-slate-50/50',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-md">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">DepositDesk</h2>
        <p className="text-xs text-muted-foreground">
          AICTE Security Deposit & Fixed Deposit Receipt (FDR) Lifecycle Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="card-notion p-6 shadow-md border-border bg-white space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-notion pl-9 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-notion pl-9 text-xs"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full text-xs py-2 font-semibold shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick 1-Click Role Switcher */}
          <div className="pt-4 border-t border-border space-y-2.5">
            <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase text-muted-foreground">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Or Choose a Demo Role (1-Click Instant Login)</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.role}
                  type="button"
                  onClick={() => handleQuickLogin(demo.role)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${demo.color} flex items-start justify-between group`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground group-hover:text-blue-600 transition-colors">
                        {demo.title}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-2xs font-bold bg-white border border-border">
                        {demo.badge}
                      </span>
                    </div>
                    <p className="text-2xs font-medium text-slate-600">{demo.subtitle}</p>
                    <p className="text-2xs text-muted-foreground leading-tight line-clamp-1">{demo.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
