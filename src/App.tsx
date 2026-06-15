import { useEffect, useState, lazy, Suspense } from 'react';
import './index.css';
import useLenis from './hooks/useLenis';
import { siteConfig } from './config';
import Hero from './sections/Hero';
import ParallaxGallery from './sections/ParallaxGallery';
import TourSchedule from './sections/TourSchedule';
import Footer from './sections/Footer';
import { Dashboard } from './dashboard';
import { LoginPage } from './dashboard/LoginPage';
import { SubscriptionPage } from './dashboard/SubscriptionPage';
import { api } from './dashboard/api';

// Lazy-load the Three.js cube — keeps it out of the initial JS chunk (~400 kB saving)
const StrategyCube = lazy(() => import('./sections/StrategyCube'));

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard' | 'plans'>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);

  // Initialize Lenis smooth scrolling
  useLenis();

  useEffect(() => {
    // Set page title from config
    if (siteConfig.title) {
      document.title = siteConfig.title;
    }

    // Add viewport meta for better mobile experience
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }

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

  const navigateToDashboard = () => {
    if (isAuthenticated) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('login');
    }
  };

  const navigateToLanding = () => {
    setCurrentView('landing');
  };

  const navigateToPlans = () => {
    setCurrentView('plans');
  };

  const navigateToLogin = () => {
    setCurrentView('login');
  };

  const userEmail = typeof user?.email === 'string' ? user.email : '';
  const userTier = typeof user?.subscription === 'object' && user.subscription
    ? String((user.subscription as { tier?: unknown }).tier ?? 'free')
    : 'free';
  const isFounder = user?.isFounder === true || userTier === 'founder';

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-[#050508] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Checking session…</p>
        </div>
      </main>
    );
  }

  // Render based on current view
  if (currentView === 'dashboard' && isAuthenticated) {
    return (
      <main className="relative w-full min-h-screen bg-[#050508]">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050508]/90 backdrop-blur-md border-b border-gray-800">
          <div className="flex items-center justify-between px-6 py-4">
            <button 
              onClick={navigateToLanding}
              className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
            >
              TRADEFLOW AI
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={navigateToPlans}
                className="text-sm text-gray-400 hover:text-white"
              >
                Plans
              </button>
              <span className="text-sm text-gray-400">
                {userEmail ? `${userEmail} · ${userTier}` : 'Dashboard'}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>
        <div className="pt-16">
          <Dashboard />
        </div>
      </main>
    );
  }

  if (currentView === 'login') {
    return (
      <main className="relative w-full min-h-screen bg-[#050508]">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050508]/90 backdrop-blur-md border-b border-gray-800">
          <div className="flex items-center justify-between px-6 py-4">
            <button 
              onClick={navigateToLanding}
              className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
            >
              TRADEFLOW AI
            </button>
          </div>
        </nav>
        <div className="pt-16">
          <LoginPage onLogin={handleLogin} />
        </div>
      </main>
    );
  }

  if (currentView === 'plans') {
    return (
      <main className="relative w-full min-h-screen bg-[#050508]">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050508]/90 backdrop-blur-md border-b border-gray-800">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={navigateToLanding}
              className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
            >
              TRADEFLOW AI
            </button>
            <div className="flex items-center gap-4">
              <button onClick={navigateToLogin} className="text-sm text-gray-400 hover:text-white">
                Sign in
              </button>
              <button
                onClick={navigateToDashboard}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg transition-colors"
              >
                Dashboard
              </button>
            </div>
          </div>
        </nav>
        <div className="pt-16">
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
        </div>
      </main>
    );
  }

  // Landing page
  return (
    <main className="relative w-full min-h-screen bg-void-black overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-void-black/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            TRADEFLOW AI
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={navigateToPlans}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold rounded-lg transition-colors"
            >
              Plans
            </button>
            {!isAuthenticated && (
              <button
                onClick={navigateToLogin}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold rounded-lg transition-colors"
              >
                Sign in
              </button>
            )}
            <button
              onClick={navigateToDashboard}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg transition-colors"
            >
              {isAuthenticated ? 'Dashboard' : 'Start'}
            </button>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-red-300 hover:text-red-200 font-semibold transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section - Immersive landing */}
      <div className="pt-16">
        <Hero />
      </div>

      {/* Strategy Cube Section - 3D showcase (lazy-loaded) */}
      <Suspense fallback={
        <div className="relative bg-[#050508] py-24 flex items-center justify-center h-[600px]">
          <div className="w-10 h-10 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      }>
        <StrategyCube />
      </Suspense>

      {/* Parallax Gallery Section */}
      <ParallaxGallery />

      {/* Tour Schedule Section */}
      <TourSchedule />

      {/* Footer Section */}
      <Footer />
    </main>
  );
}

export default App;
