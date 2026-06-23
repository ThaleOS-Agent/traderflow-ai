import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck, Wallet, Crown } from 'lucide-react';
import { api } from './api';

interface LoginPageProps {
  onLogin: (user?: Record<string, unknown>) => void;
}

type Mode = 'login' | 'register';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [founderLoading, setFounderLoading] = useState(false);
  const [error, setError] = useState('');
  const [founderError, setFounderError] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const isFounderUser = (user: Record<string, unknown>) => {
    if (user.isFounder === true) {
      return true;
    }

    const subscription = user.subscription;
    if (subscription && typeof subscription === 'object' && 'tier' in subscription) {
      return String((subscription as { tier?: unknown }).tier ?? '') === 'founder';
    }

    return String(user.tier ?? '') === 'founder';
  };

  const normalizeFounderUser = (user: Record<string, unknown>, walletAddress: string) => ({
    ...user,
    walletAddress,
    isFounder: true,
    subscription: {
      tier: 'founder',
      status: 'lifetime',
      expiresAt: null,
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await api.login(form.email, form.password);
        onLogin(data.user);
      } else {
        const data = await api.register({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          country: form.country,
        });
        onLogin(data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleFounderWalletLogin = async () => {
    setFounderError('');

    if (!window.ethereum) {
      setFounderError('MetaMask not detected. Install a compatible EVM wallet for Founder access.');
      return;
    }

    setFounderLoading(true);

    try {
      const sessionRes = await api.createWalletSession();
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const address = accounts[0];

      if (!address) {
        throw new Error('No wallet account returned');
      }

      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const chainId = parseInt(chainIdHex, 16);
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [sessionRes.session.message, address],
      }) as string;

      const data = await api.verifyWallet({
        sessionId: sessionRes.session.id,
        address,
        chainId,
        signature,
        message: sessionRes.session.message,
      });

      if (!isFounderUser(data.user)) {
        api.logout();
        throw new Error('Wallet authenticated, but this address is not allowlisted for Founder access.');
      }

      onLogin(normalizeFounderUser(data.user, address.toLowerCase()));
    } catch (err) {
      const walletError = err as { code?: number; message?: string };
      if (walletError.code === 4001) {
        setFounderError('Wallet signature request was rejected.');
      } else {
        setFounderError(walletError.message ?? 'Founder wallet login failed.');
      }
    } finally {
      setFounderLoading(false);
    }
  };

  return (
    <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-[1440px] gap-10 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-16">
      <div className="flex flex-col justify-between rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,35,0.94),rgba(7,12,19,0.98))] p-8">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Operator access</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
            Trade with a clear operating surface, not a noisy terminal.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            Sign in to review market research, risk posture, venue connectivity, and automated execution in one place.
          </p>
        </div>

        <div className="mt-10 space-y-4">
          {[
            'Paper trading is enabled by default for safer onboarding.',
            'Exchange and broker credentials are stored encrypted at rest.',
            'Live order routing remains behind explicit risk and connection checks.',
          ].map(item => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center">
        <div className="w-full rounded-[32px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_28px_70px_rgba(0,0,0,0.34)]">
          <div className="mb-8 flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
            {(['login', 'register'] as Mode[]).map(currentMode => (
              <button
                key={currentMode}
                onClick={() => { setMode(currentMode); setError(''); }}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  mode === currentMode
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {currentMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">First name</span>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={set('firstName')}
                    required
                    maxLength={50}
                    autoComplete="given-name"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/50"
                    placeholder="John"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Last name</span>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={set('lastName')}
                    required
                    maxLength={50}
                    autoComplete="family-name"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/50"
                    placeholder="Doe"
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                maxLength={254}
                autoComplete="email"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/50"
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-12 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/50"
                  placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {mode === 'register' && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Phone</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    autoComplete="tel"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/50"
                    placeholder="+64 21 555 555"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500">Country</span>
                  <input
                    type="text"
                    value={form.country}
                    onChange={set('country')}
                    autoComplete="country-name"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/50"
                    placeholder="New Zealand"
                  />
                </label>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-4 text-base font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Open dashboard' : 'Create account'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-8 rounded-[28px] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(120,53,15,0.16),rgba(10,14,23,0.24))] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-amber-300/70">Founder access</p>
                <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                  <Crown className="h-5 w-5 text-amber-300" />
                  Wallet-only Founder sign-in
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Founder accounts use the wallet allowlist path and receive lifetime premium access across all bots, strategies, paper, and live execution controls.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Allowlisted EVM wallet required</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">No password fallback</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Immediate Founder tier session</div>
            </div>

            {founderError && (
              <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {founderError}
              </div>
            )}

            <button
              type="button"
              onClick={handleFounderWalletLogin}
              disabled={founderLoading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/90 px-6 py-4 text-base font-semibold text-slate-950 transition-colors hover:bg-amber-200 disabled:opacity-60"
            >
              {founderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {founderLoading ? 'Verifying Founder wallet' : 'Enter with Founder wallet'}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="font-medium text-cyan-300 hover:text-cyan-200"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
