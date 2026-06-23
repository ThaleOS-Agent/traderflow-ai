import { useEffect, useState } from 'react';
import { ArrowRight, Menu, User2 } from 'lucide-react';
import './index.css';
import useLenis from './hooks/useLenis';
import { siteConfig } from './config';
import { Dashboard } from './dashboard';
import { LoginPage } from './dashboard/LoginPage';
import { SubscriptionPage } from './dashboard/SubscriptionPage';
import { api } from './dashboard/api';
import { MarketingLanding } from './sections/MarketingLanding';

type View = 'landing' | 'login' | 'dashboard' | 'plans';

function ShellNav({
  brandAction,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  userLabel,
}: {
  brandAction: () => void;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  tertiaryAction?: { label: string; onClick: () => void };
  userLabel?: string;
}) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#07111b]/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 lg:px-10">
        <button onClick={brandAction} className="flex items-center gap-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
            <Menu className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">TradeFlow AI</p>
            <p className="text-base font-semibold text-white">Automated Trading Platform</p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {userLabel && (
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 md:flex">
              <User2 className="h-4 w-4 text-slate-500" />
              {userLabel}
            </div>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.06]"
            >
              {secondaryAction.label}
            </button>
          )}
          {tertiaryAction && (
            <button
              onClick={tertiaryAction.onClick}
              className="rounded-2xl px-4 py-2.5 text-sm font-medium text-rose-200 transition-colors hover:text-white"
            >
              {tertiaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
            >
              {primaryAction.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function App() {
  const [currentView, setCurrentView] = useState<View>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);

  useLenis();

  useEffect(() => {
    if (siteConfig.title) document.title = siteConfig.title;

    let active = true;

    async function verifySession() {
      if (!api.isAuthenticated()) {
        if (active) setAuthChecked(true);
        return;
      }

      try {
        const data = await api.getMe();
        if (!active) return;
        setUser(data.user);
        setIsAuthenticated(true);
      } catch {
        api.logout();
        if (!active) return;
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (active) setAuthChecked(true);
      }
    }

    verifySession();
    return () => { active = false; };
  }, []);

  const handleLogin = (nextUser?: Record<string, unknown>) => {
    setUser(nextUser ?? null);
    setIsAuthenticated(true);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setIsAuthenticated(false);
    setCurrentView('landing');
  };

  const subscriptionTier = typeof user?.subscription === 'object' && user.subscription
    ? String((user.subscription as { tier?: unknown }).tier ?? '')
    : '';
  const directTier = typeof user?.tier === 'string' ? user.tier : '';
  const userTier = subscriptionTier || directTier || (user?.isFounder === true ? 'founder' : 'free');
  const userEmail = typeof user?.email === 'string' ? user.email : '';
  const isFounder = userTier === 'founder';

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#07111b]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-cyan-300/40 border-t-cyan-300 animate-spin" />
          <p className="text-sm text-slate-400">Checking session…</p>
        </div>
      </main>
    );
  }

  if (currentView === 'dashboard' && isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#07111b]">
        <ShellNav
          brandAction={() => setCurrentView('landing')}
          secondaryAction={{ label: 'Plans', onClick: () => setCurrentView('plans') }}
          tertiaryAction={{ label: 'Logout', onClick: handleLogout }}
          userLabel={userEmail ? `${userEmail} · ${userTier}` : 'Dashboard'}
        />
        <Dashboard />
      </main>
    );
  }

  if (currentView === 'login') {
    return (
      <main className="min-h-screen bg-[#07111b]">
        <ShellNav
          brandAction={() => setCurrentView('landing')}
          primaryAction={{ label: isAuthenticated ? 'Dashboard' : 'Plans', onClick: () => setCurrentView(isAuthenticated ? 'dashboard' : 'plans') }}
        />
        <LoginPage onLogin={handleLogin} />
      </main>
    );
  }

  if (currentView === 'plans') {
    return (
      <main className="min-h-screen bg-[#07111b]">
        <ShellNav
          brandAction={() => setCurrentView('landing')}
          secondaryAction={{ label: 'Sign in', onClick: () => setCurrentView('login') }}
          primaryAction={{ label: isAuthenticated ? 'Dashboard' : 'Get started', onClick: () => setCurrentView(isAuthenticated ? 'dashboard' : 'login') }}
          userLabel={isAuthenticated ? `${userEmail} · ${userTier}` : undefined}
        />
        <SubscriptionPage
          currentTier={isAuthenticated ? userTier : 'free'}
          isFounder={isAuthenticated && isFounder}
          onUpgrade={(tier) => {
            if (!isAuthenticated) {
              setCurrentView('login');
              return;
            }
            window.location.href = tier === 'founder'
              ? 'mailto:founder@tradeflow.ai?subject=Founder Access Request'
              : `mailto:billing@tradeflow.ai?subject=Upgrade to ${tier} plan`;
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07111b]">
      <ShellNav
        brandAction={() => setCurrentView('landing')}
        secondaryAction={{ label: 'Plans', onClick: () => setCurrentView('plans') }}
        primaryAction={{ label: isAuthenticated ? 'Open dashboard' : 'Sign in', onClick: () => setCurrentView(isAuthenticated ? 'dashboard' : 'login') }}
        tertiaryAction={isAuthenticated ? { label: 'Logout', onClick: handleLogout } : undefined}
        userLabel={isAuthenticated ? `${userEmail} · ${userTier}` : undefined}
      />

      <MarketingLanding
        onPrimaryAction={() => setCurrentView(isAuthenticated ? 'dashboard' : 'login')}
        onSecondaryAction={() => setCurrentView(isAuthenticated ? 'dashboard' : 'plans')}
        onPricingAction={() => setCurrentView('plans')}
      />
    </main>
  );
}

export default App;
