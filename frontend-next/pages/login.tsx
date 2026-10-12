import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('kasir');
  const [password, setPassword] = useState('kasir123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('billiard_auth_token', data.token);
        localStorage.setItem('billiard_auth_user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.error || 'Username atau password salah.');
      }
    } catch (err: any) {
      setError('Koneksi ke edge server gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f17] flex items-center justify-center p-4 antialiased text-slate-900 dark:text-slate-100">
      <Head>
        <title>Sign In - BilliardStream Hub</title>
      </Head>

      <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-sm w-full shadow-sm">
        {/* Simple Brand */}
        <div className="mb-6">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-base mb-3">
            B
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">BilliardStream Hub</h2>
          <p className="text-xs text-slate-500 mt-0.5">Arena Cashier &amp; CCTV Console</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <User className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-lg p-2.5 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-xs transition-colors flex items-center justify-center space-x-1.5 mt-2"
          >
            <span>{loading ? 'Memvalidasi...' : 'Masuk ke Dashboard'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
          Operator ID: <code className="text-slate-600 dark:text-slate-300 font-mono">kasir / kasir123</code>
        </div>
      </div>
    </div>
  );
}
