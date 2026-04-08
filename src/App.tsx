import { useEffect, useState } from 'react';
import './index.css';
import useLenis from './hooks/useLenis';
import { siteConfig } from './config';
import Hero from './sections/Hero';
import StrategyCube from './sections/StrategyCube';
import ParallaxGallery from './sections/ParallaxGallery';
import TourSchedule from './sections/TourSchedule';
import Footer from './sections/Footer';
import { Dashboard } from './dashboard';
import { LoginPage } from './dashboard/LoginPage';
import { api } from './dashboard/api';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard'>('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

    // Check if user is already authenticated
    if (api.isAuthenticated()) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    api.logout();
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
              <span className="text-sm text-gray-400">Dashboard</span>
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

  // Landing page
  return (
    <main className="relative w-full min-h-screen bg-void-black overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-void-black/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            TRADEFLOW AI
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={navigateToDashboard}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg transition-colors"
            >
              {isAuthenticated ? 'Dashboard' : 'Login'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Immersive landing */}
      <div className="pt-16">
        <Hero />
      </div>

      {/* Strategy Cube Section - 3D showcase */}
      <StrategyCube />

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
