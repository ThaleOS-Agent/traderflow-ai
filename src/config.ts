// ── Site-wide configuration ─────────────────────────────────────────────────

export const siteConfig = {
  title: 'TradeFlow AI — Automated Trading Platform',
  description: 'AI-powered trading signals and automated strategy execution across crypto, forex, and commodities.',
  brandName: 'TradeFlow AI',
};

// ── Hero section ─────────────────────────────────────────────────────────────

export const heroConfig = {
  brandName: 'TRADEFLOW AI',
  backgroundImage: '/hero-bg.jpg',
  decodeText: 'TRADE SMARTER',
  decodeChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()',
  subtitle: 'AI-POWERED AUTOMATED TRADING — CRYPTO · FOREX · COMMODITIES',
  ctaPrimary: 'Start Trading',
  ctaPrimaryTarget: 'strategies',
  ctaSecondary: 'View Signals',
  ctaSecondaryTarget: 'gallery',
  cornerLabel: 'LIVE SIGNALS',
  cornerDetail: '24/7 Market Coverage',
  navItems: [
    { sectionId: 'strategies', label: 'Strategies', icon: 'chart' as const },
    { sectionId: 'gallery',    label: 'Signals',    icon: 'disc' as const },
    { sectionId: 'tour',       label: 'Features',   icon: 'play' as const },
    { sectionId: 'footer',     label: 'Contact',    icon: 'calendar' as const },
  ],
};

// ── Parallax Gallery section ──────────────────────────────────────────────────

export const parallaxGalleryConfig = {
  sectionLabel: 'LIVE MARKET INTELLIGENCE',
  sectionTitle: 'Real-time signals.\nInstant execution.',

  parallaxImagesTop: [
    { id: 'mc1', src: '/market-charts-1.jpg', alt: 'BTC/USDT chart pattern' },
    { id: 'mc2', src: '/market-charts-2.jpg', alt: 'ETH/USDT breakout' },
    { id: 'mc3', src: '/market-charts-3.jpg', alt: 'Forex EUR/USD analysis' },
    { id: 'mc4', src: '/market-charts-4.jpg', alt: 'Gold harmonic pattern' },
    { id: 'mc5', src: '/market-charts-5.jpg', alt: 'Crypto arbitrage opportunity' },
    { id: 'mc6', src: '/market-charts-6.jpg', alt: 'Oil futures signal' },
  ],

  parallaxImagesBottom: [
    { id: 'sl1', src: '/signal-live.jpg',   alt: 'Live trade signal' },
    { id: 'sp1', src: '/signal-profit.jpg', alt: 'Profit signal confirmation' },
    { id: 'ac1', src: '/algo-crypto.jpg',   alt: 'Crypto algorithm in action' },
    { id: 'af1', src: '/algo-forex.jpg',    alt: 'Forex algorithm running' },
    { id: 'am1', src: '/algo-metals.jpg',   alt: 'Metals strategy' },
    { id: 'ao1', src: '/algo-oil.jpg',      alt: 'Oil trading strategy' },
  ],

  marqueeTexts: [
    'QUANTUM AI STRATEGY',
    'XQ TRADE M8',
    'HARMONIC PATTERNS',
    'ENSEMBLE MASTER',
    'ARBITRAGE BOT',
    'ML PREDICTIONS',
    'MULTI-EXCHANGE',
  ],

  galleryLabel: 'STRATEGY SHOWCASE',
  galleryTitle: 'Six proven algorithms.',

  galleryImages: [
    { id: 'g1', src: '/algo-quantum.jpg',  title: 'Quantum AI',      date: 'Strategy 01' },
    { id: 'g2', src: '/algo-crypto.jpg',   title: 'Crypto Bot',      date: 'Strategy 02' },
    { id: 'g3', src: '/algo-forex.jpg',    title: 'Forex Pro',       date: 'Strategy 03' },
    { id: 'g4', src: '/algo-metals.jpg',   title: 'Metals Trader',   date: 'Strategy 04' },
    { id: 'g5', src: '/algo-oil.jpg',      title: 'Oil Trader',      date: 'Strategy 05' },
    { id: 'g6', src: '/algo-risk.jpg',     title: 'Risk Manager',    date: 'Strategy 06' },
  ],

  endCtaText: 'See All Features',
};
