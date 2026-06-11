import { useState } from 'react';
import type { FormEvent } from 'react';
import { TrendingUp, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { api } from './api';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await api.login(email, password);
      onLogin();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Invalid credentials. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            TRADEFLOW AI
          </span>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-xl font-semibold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-gray-400 mb-6">Sign in to your trading dashboard</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 pr-12 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-all duration-200 text-sm mt-2"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            Paper trading mode is enabled by default. No real funds at risk.
          </p>
        </div>
      </div>
    </div>
  );
}
