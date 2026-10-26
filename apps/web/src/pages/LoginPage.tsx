import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, ArrowRight } from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';

export const LoginPage: React.FC = () => {
  const { login, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to sign in. Check your connection and try again.'));
    } finally { setIsLoading(false); }
  };
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Shield className="w-10 h-10 text-orange-600 mx-auto" />
          <h1 className="text-2xl font-bold">DepositDesk</h1>
          <p className="text-sm text-slate-600">Security Deposit & FDR Management</p>
          {isDemoMode && <p className="text-xs text-amber-800">Demo environment — synthetic data</p>}
        </div>
        <form onSubmit={handleSubmit} className="card-notion bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Sign in to your workspace</h2>
          {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email address</label>
            <input id="email" type="email" autoComplete="username" className="input-notion w-full" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <input id="password" type="password" autoComplete="current-password" className="input-notion w-full" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button disabled={isLoading} type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
            {isLoading ? 'Signing in…' : 'Sign in'}<ArrowRight className="w-4 h-4" />
          </button>
          {isDemoMode && <p className="text-xs text-slate-600">Use an account and its generated password from the local seed output. To change roles, sign out and sign in with the appropriate account.</p>}
        </form>
        <p className="text-xs text-slate-500 text-center">Prototype for AICTE problem statement 26265. No live bank or AICTE integration.</p>
      </section>
    </main>
  );
};
